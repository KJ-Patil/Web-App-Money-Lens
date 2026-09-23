import { formatAmount } from "@/core/utils/currencyManager";

export type ReminderTone = "friendly" | "formal" | "urgent";
export type ReminderLang = "en" | "hi" | "mr";
export type ReminderRelation = "credit" | "debit" | "settlement";

interface TemplateMap {
  friendly: string;
  formal: string;
  urgent: string;
}

const TEMPLATES: Record<ReminderRelation, Record<ReminderLang, TemplateMap>> = {
  credit: {
    en: {
      friendly: "Hi {name}, just a friendly reminder that you have a pending balance of {amount} on MoneyLens. You can settle it whenever you're ready. Thanks!",
      formal: "Dear {name}, this is a payment reconciliation notice. Please review your outstanding balance of {amount} on your MoneyLens account and clear the payment at your earliest convenience. Regards.",
      urgent: "URGENT: Dear {name}, your pending balance of {amount} is overdue. Please settle this amount immediately via UPI or Bank transfer. Thank you.",
    },
    hi: {
      friendly: "नमस्ते {name}, बस एक छोटा सा रिमाइंडर कि आपका मनीलेन्स (MoneyLens) पर {amount} का बैलेंस पेंडिंग है। जब आप तैयार हों, तब इसका निपटान कर सकते हैं। धन्यवाद!",
      formal: "प्रिय {name}, यह भुगतान मिलान (reconciliation) सूचना है। कृपया मनीलेन्स पर अपने {amount} के लंबित बैलेंस की समीक्षा करें और जल्द से जल्द इसका भुगतान करें। सादर।",
      urgent: "महत्वपूर्ण: प्रिय {name}, आपका {amount} का बैलेंस अतिदेय (overdue) हो गया है। कृपया इस राशि का तुरंत भुगतान करें। धन्यवाद।",
    },
    mr: {
      friendly: "नमस्कार {name}, एक छोटीशी आठवण की तुमचे मनीलेन्स (MoneyLens) वर {amount} चे देणे प्रलंबित आहे. सोयीनुसार पेमेंट करू शकता. धन्यवाद!",
      formal: "प्रिय {name}, ही पेमेंट रिकॉन्सिलिएशन नोटीस आहे. कृपया मनीलेन्स वरील आपल्या {amount} प्रलंबित रकमेची पडताळणी करा आणि लवकरात लवकर त्याचे पेमेंट करा. सादर.",
      urgent: "तातडीचे: प्रिय {name}, तुमचे {amount} चे देणे प्रलंबित (overdue) झाले आहे. कृपया या रकमेचे त्वरित पेमेंट करा. धन्यवाद.",
    },
  },
  debit: {
    en: {
      friendly: "Hi {name}, regarding the balance of {amount} I owe you, I'll clear it soon. Thanks!",
      formal: "Dear {name}, this is a payment confirmation notice. Your balance of {amount} is being processed and will be cleared shortly. Regards.",
      urgent: "Dear {name}, confirming that your payment of {amount} is being initiated right now. Thank you for your patience.",
    },
    hi: {
      friendly: "नमस्ते {name}, आपके {amount} के बैलेंस के संबंध में, मैं इसे जल्द ही चुका दूंगा। धन्यवाद!",
      formal: "प्रिय {name}, यह भुगतान पुष्टि सूचना है। आपका {amount} का बैलेंस संसाधित किया जा रहा है और जल्द ही भुगतान कर दिया जाएगा। सादर।",
      urgent: "प्रिय {name}, पुष्टि की जाती है कि आपके {amount} का भुगतान अभी शुरू किया जा रहा है। आपके धैर्य के लिए धन्यवाद।",
    },
    mr: {
      friendly: "नमस्कार {name}, आपल्या {amount} च्या प्रलंबित रकमेबद्दल, मी ते लवकरच क्लिअर करेन. धन्यवाद!",
      formal: "प्रिय {name}, ही पेमेंट पुष्टीकरण नोटीस आहे. आपले {amount} चे पेमेंट लवकरच केले जाईल. सादर.",
      urgent: "प्रिय {name}, आपल्या {amount} च्या पेमेंटची प्रक्रिया आत्ताच सुरू केली आहे. आपल्या सहकार्याबद्दल धन्यवाद.",
    },
  },
  settlement: {
    en: {
      friendly: "Hi {name}, you owe me {amount} for our shared expenses. Please transfer when possible. Thanks!",
      formal: "Dear {name}, this is a reminder regarding your share of {amount} for our group expenses. Please settle it when you can. Regards.",
      urgent: "Hi {name}, please settle your share of {amount} for our shared expenses as soon as possible. Thank you!",
    },
    hi: {
      friendly: "नमस्ते {name}, हमारे साझा खर्चों के लिए आपका मुझ पर {amount} बकाया है। कृपया सुविधानुसार ट्रांसफर करें। धन्यवाद!",
      formal: "प्रिय {name}, यह समूह खर्चों में आपके {amount} के हिस्से के संबंध में एक रिमाइंडर है। कृपया भुगतान करें। सादर।",
      urgent: "नमस्ते {name}, कृपया हमारे साझा खर्चों में अपने {amount} के हिस्से का भुगतान जल्द से जल्द करें। धन्यवाद!",
    },
    mr: {
      friendly: "नमस्कार {name}, आमच्या सामायिक खर्चासाठी तुमचे {amount} चे देणे आहे. सोयीनुसार ट्रान्सफर करा. धन्यवाद!",
      formal: "प्रिय {name}, ग्रुप खर्चातील आपल्या {amount} च्या हिश्श्याबद्दल हा एक रिमाइंडर आहे. सोयीनुसार पेमेंट करा. सादर.",
      urgent: "नमस्कार {name}, आमच्या सामायिक खर्चातील आपल्या {amount} च्या हिश्श्याचे पेमेंट कृपया त्वरित करा. धन्यवाद!",
    },
  },
};

/**
 * Generates the reminder message using the given settings.
 */
export function generateReminderMessage(
  name: string,
  amount: number,
  relation: ReminderRelation,
  lang: ReminderLang = "en",
  tone: ReminderTone = "friendly",
  currency: string = "INR"
): string {
  const amountStr = formatAmount(amount, currency);
  const templateMap = TEMPLATES[relation]?.[lang] || TEMPLATES[relation].en;
  const template = templateMap[tone] || templateMap.friendly;

  return template
    .replace("{name}", name)
    .replace("{amount}", amountStr);
}

/**
 * Normalizes a phone number to standard format (digits only).
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

/**
 * Builds a redirection link to WhatsApp Web/App.
 */
export function getWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = normalizePhoneNumber(phone);
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Builds a redirection link to Native SMS.
 */
export function getSmsLink(phone: string, message: string): string {
  const cleanPhone = normalizePhoneNumber(phone);
  // Using E.164 phone number, prefixing with + if it doesn't have one and starts with non-zero
  const finalPhone = cleanPhone.startsWith("0") || cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone}`;
  return cleanPhone
    ? `sms:${finalPhone}?body=${encodeURIComponent(message)}`
    : `sms:?body=${encodeURIComponent(message)}`;
}

