export interface ParsedVoiceData {
  amount: number | null;
  type: "expense" | "income" | null;
  category: string | null;
  description: string;
  personName: string | null;
}

// Spoken number words — both Hinglish (Latin) and Devanagari, since the browser
// transcribes hi-IN speech into Devanagari script.
const NUMBER_MAP: Record<string, number> = {
  // Hinglish
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5, panch: 5, che: 6, chhe: 6,
  saat: 7, aath: 8, nau: 9, das: 10,
  sau: 100, hazaar: 1000, hazar: 1000, lakh: 100000, crore: 10000000,
  // Devanagari (Hindi)
  एक: 1, दो: 2, तीन: 3, चार: 4, पाँच: 5, पांच: 5, छह: 6, छे: 6,
  सात: 7, आठ: 8, नौ: 9, दस: 10,
  सौ: 100, हज़ार: 1000, हजार: 1000, लाख: 100000, करोड़: 10000000,
  // Marathi (where different from Hindi)
  दोन: 2, पाच: 5, सहा: 6, नऊ: 9,
  शंभर: 100, कोटी: 10000000,
};

const CATEGORY_MAP: Record<string, string> = {
  // English
  grocery: "Groceries", groceries: "Groceries", vegetables: "Groceries",
  fruits: "Groceries", market: "Groceries", supermarket: "Groceries",
  food: "Food", meal: "Food", restaurant: "Food", lunch: "Food",
  dinner: "Food", breakfast: "Food", snack: "Food", cafe: "Food",
  coffee: "Food", tea: "Food", dining: "Food", canteen: "Food",
  house: "Housing", housing: "Housing", rent: "Housing",
  apartment: "Housing", flat: "Housing", home: "Housing",
  movie: "Entertainment", movies: "Entertainment", game: "Entertainment",
  gaming: "Entertainment", music: "Entertainment", netflix: "Entertainment",
  entertainment: "Entertainment", show: "Entertainment",
  travel: "Travel", trip: "Travel", cab: "Travel", taxi: "Travel",
  uber: "Travel", ola: "Travel", bus: "Travel", train: "Travel",
  flight: "Travel", metro: "Travel", fuel: "Travel", diesel: "Travel",
  petrol: "Travel", commute: "Travel", transport: "Travel",
  electricity: "Utilities", water: "Utilities", utility: "Utilities",
  doctor: "Medical", hospital: "Medical", medicine: "Medical",
  medical: "Medical", health: "Medical", pharmacy: "Medical",
  invest: "Investment", investment: "Investment", stocks: "Investment",
  shares: "Investment", mutual: "Investment", sip: "Investment",
  salary: "Salary", wages: "Salary",
  gift: "Gift", present: "Gift",
  // Hinglish
  khana: "Groceries", khane: "Groceries", bhojan: "Groceries",
  yatra: "Travel",
  bijli: "Utilities", makan: "Housing", kiraya: "Housing",
  cinema: "Entertainment", khel: "Entertainment",
  dawai: "Medical", dawa: "Medical", nivesh: "Investment",
  // Devanagari (Hindi)
  खाना: "Groceries", खाने: "Groceries", भोजन: "Groceries",
  पेट्रोल: "Travel", यात्रा: "Travel",
  बिजली: "Utilities", मकान: "Housing", किराया: "Housing",
  सिनेमा: "Entertainment", खेल: "Entertainment",
  दवाई: "Medical", दवा: "Medical", निवेश: "Investment",
  // Marathi
  जेवण: "Food", खाणे: "Food", नाश्ता: "Food",
  भाजी: "Groceries", भाजीपाला: "Groceries", किराणा: "Groceries",
  भाडे: "Housing", घर: "Housing",
  वीज: "Utilities", पाणी: "Utilities", गॅस: "Utilities",
  औषध: "Medical", दवाखाना: "Medical", हॉस्पिटल: "Medical",
  प्रवास: "Travel", गाडी: "Travel", रिक्षा: "Travel", बस: "Travel",
  मनोरंजन: "Entertainment", चित्रपट: "Entertainment", गाणे: "Entertainment",
  गुंतवणूक: "Investment",
  पगार: "Salary",
  भेट: "Gift",
};

const INCOME_WORDS = [
  // English
  "receive", "received", "got", "earn", "earned", "credited",
  "deposit", "deposited", "refund", "refunded", "income",
  // Hinglish
  "mila", "aaya", "prapt", "kamaai",
  // Devanagari (Hindi)
  "मिला", "मिले", "आया", "प्राप्त", "कमाई", "आय",
  // Marathi — root forms so includes() catches all conjugations
  // मिळ → मिळाला, मिळाले, मिळाली, मिळाल्या
  "मिळ", "जमा", "कमाव", "उत्पन्न",
  // "to me" pronouns — "[Person] मला दिले" = gave TO ME = I received
  "मला", "मज", "मुझे", "मुझको",
];
const EXPENSE_WORDS = [
  // English
  "spend", "spent", "paid", "bought", "buy", "purchase",
  "purchased", "expense", "cost", "bill", "give", "gave", "send", "sent",
  // Hinglish
  "diya", "diye", "kharcha", "kharch", "gaya", "bheja",
  // Devanagari (Hindi)
  "दिया", "दिए", "खर्च", "खर्चा", "गया", "हुआ", "खरीदा", "भेजा",
  // Marathi — root forms so includes() catches all conjugations
  // दिल → दिला, दिले, दिली; गेल → गेला, गेले; घेतल → घेतला, घेतले
  "दिल", "गेल", "भरल", "घेतल", "विकत",
];

export function parseVoiceInput(text: string): ParsedVoiceData {
  // Split into words and trim surrounding punctuation/symbols (e.g. a leading
  // "₹" or the Devanagari full-stop "।"). We keep digits, letters AND combining
  // marks (\p{M}) — Devanagari vowel signs like the "े" in "खाने" are marks, not
  // letters, so stripping them would corrupt the word.
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\d\p{L}\p{M}]+|[^\d\p{L}\p{M}]+$/gu, ""))
    .filter(Boolean);

  let amount: number | null = null;
  let type: "expense" | "income" | null = null;
  let category: string | null = null;

  // ── Extract amount ──────────────────────────────────────────────────────
  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Pull the digits out of the token, ignoring any currency symbols or
    // separators that survived (e.g. "₹100", "rs.100", "1,000").
    const numericPart = word.replace(/[^\d.]/g, "");
    const parsedNumber = numericPart ? parseFloat(numericPart) : NaN;

    if (!isNaN(parsedNumber)) {
      amount = parsedNumber;
      // Look ahead for a multiplier like "sau"/"सौ" or "hazaar"/"हज़ार".
      const next = words[i + 1];
      if (next && NUMBER_MAP[next] && NUMBER_MAP[next] >= 100) {
        amount *= NUMBER_MAP[next];
      }
      break;
    }

    // Spoken number word (e.g. "paanch", "दो") possibly with a multiplier.
    if (NUMBER_MAP[word] && NUMBER_MAP[word] < 100) {
      let tempAmt = NUMBER_MAP[word];
      const next = words[i + 1];
      if (next && NUMBER_MAP[next] >= 100) {
        tempAmt *= NUMBER_MAP[next];
      }
      amount = tempAmt;
      break;
    }
  }

  // If no amount found, accept a standalone multiplier ("hazaar" = 1000).
  if (amount === null) {
    for (const word of words) {
      if (NUMBER_MAP[word] >= 100) {
        amount = NUMBER_MAP[word];
        break;
      }
    }
  }

  // ── Extract category ────────────────────────────────────────────────────
  for (const word of words) {
    if (CATEGORY_MAP[word]) {
      category = CATEGORY_MAP[word];
      break;
    }
    // Direct English category name match (e.g. "groceries").
    const englishMatch = Object.values(CATEGORY_MAP).find((c) => c.toLowerCase() === word);
    if (englishMatch) {
      category = englishMatch;
      break;
    }
  }

  // ── Extract type ────────────────────────────────────────────────────────
  for (const word of words) {
    if (INCOME_WORDS.some((w) => word.includes(w))) {
      type = "income";
      break;
    }
    if (EXPENSE_WORDS.some((w) => word.includes(w))) {
      type = "expense";
      break;
    }
  }

  // Default to expense if a value was spoken but no direction given.
  if (!type && amount !== null) {
    type = "expense";
  }

  // ── Extract person name (ledger) ────────────────────────────────────────
  // Patterns: "give 500 to Arjun", "received 500 from Tushar",
  //           "Arjun ko 500 diye", "Tushar se 500 mile"
  let personName: string | null = null;

  const KNOWN_WORDS = new Set([
    ...Object.keys(NUMBER_MAP), ...Object.keys(CATEGORY_MAP),
    "i", "a", "an", "the", "my", "me", "of", "for", "on", "in", "it", "is",
    "was", "has", "have", "had", "will", "would", "can", "could", "should",
    "this", "that", "and", "or", "but", "not", "no", "yes",
    "rupees", "rupee", "rs", "inr", "payment", "money", "cash", "amount",
    "to", "from", "ko", "se", "ला", "ना", "कडून", "ने", "मला", "मज",
  ]);

  // English: "... to [Name]" or "... from [Name]"
  for (let i = 0; i < words.length; i++) {
    if (words[i] === "to" || words[i] === "from") {
      const nameWords: string[] = [];
      for (let j = i + 1; j < words.length; j++) {
        const w = words[j];
        if (KNOWN_WORDS.has(w) || /^\d+$/.test(w)) break;
        nameWords.push(w);
      }
      if (nameWords.length > 0) {
        personName = nameWords
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        break;
      }
    }
  }

  // Hindi/Marathi: "[Name] ko/se/ला/ना/कडून/ने ..."
  if (!personName) {
    const PREPOSITIONS_NAME_BEFORE = ["ko", "se", "को", "से", "ला", "ना", "कडून", "ने"];
    for (let i = 0; i < words.length; i++) {
      if (PREPOSITIONS_NAME_BEFORE.includes(words[i])) {
        const nameWords: string[] = [];
        for (let j = i - 1; j >= 0; j--) {
          const w = words[j];
          if (KNOWN_WORDS.has(w) || /^\d+$/.test(w)) break;
          nameWords.unshift(w);
        }
        if (nameWords.length > 0) {
          personName = nameWords
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
          break;
        }
      }
    }
  }

  // Marathi suffixed: "अर्जुनला" (to Arjun), "तुषारकडून" (from Tushar),
  // "तुषारणी"/"तुषारनी"/"तुषारने" (by Tushar — ergative)
  if (!personName) {
    const SUFFIXES = ["कडून", "णी", "नी", "ने", "ला", "ना"];
    for (const word of words) {
      for (const suffix of SUFFIXES) {
        if (word.endsWith(suffix) && word.length > suffix.length + 1) {
          const stem = word.slice(0, -suffix.length);
          const matchesVerb =
            INCOME_WORDS.some((w) => word.includes(w)) ||
            EXPENSE_WORDS.some((w) => word.includes(w));
          if (!matchesVerb && !KNOWN_WORDS.has(stem) && !KNOWN_WORDS.has(word)) {
            personName = stem.charAt(0).toUpperCase() + stem.slice(1);
            break;
          }
        }
      }
      if (personName) break;
    }
  }

  // When a person name is found, this is a ledger transaction.
  if (personName) {
    category = "Ledger";
  }

  // When detected as income but the keyword mapped to an expense category,
  // remap to the matching income category so the entry makes sense.
  if (type === "income" && category && category !== "Ledger") {
    const EXPENSE_TO_INCOME: Record<string, string> = {
      Housing: "Rental Income",
      Groceries: "Other",
      Food: "Other",
      Entertainment: "Other",
      Travel: "Other",
      Utilities: "Other",
      Medical: "Other",
    };
    if (EXPENSE_TO_INCOME[category]) {
      category = EXPENSE_TO_INCOME[category];
    }
  }

  // Default category: "Other" when no specific keyword was spoken — the amount
  // just goes into general liquidity without a forced assumption.
  if (!category && type === "expense") {
    category = "Other";
  } else if (!category && type === "income") {
    category = "Other";
  }

  return {
    amount,
    type,
    category,
    personName,
    description: text,
  };
}
