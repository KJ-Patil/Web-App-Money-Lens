"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, X, CheckCircle2, AlertCircle, Play, Square, BookOpen } from "lucide-react";
import { parseVoiceInput, ParsedVoiceData } from "@/core/voice/VoiceParser";
import { formatAmount } from "@/core/utils/currencyManager";
import { checkAnomaly } from "@/core/utils/AnomalyRadar";
import {
  addTransaction,
  getTransactions,
  getLedgerCustomers,
  setLedgerCustomers,
  generateId,
  type LedgerCustomer,
} from "@/core/store/dataStore";

interface VoiceLoggingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function VoiceLoggingModal({
  isOpen,
  onClose,
  onSuccess,
}: VoiceLoggingModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsedData, setParsedData] = useState<ParsedVoiceData | null>(null);
  const [success, setSuccess] = useState(false);
  const [anomalyWarning, setAnomalyWarning] = useState<string | null>(null);
  const [language, setLanguage] = useState("hi-IN");
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Stop the previous instance before creating a new one.
    const prev = recognitionRef.current;
    if (prev) {
      prev.onresult = null;
      prev.onerror = null;
      prev.onend = null;
      try { prev.stop(); } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event: any) => {
      let currentTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.stop(); } catch {}
    };
  }, [language]);

  useEffect(() => {
    if (isOpen) {
      setTranscript("");
      setParsedData(null);
      setSuccess(false);
      setAnomalyWarning(null);
      startRecording();
    } else {
      stopRecording();
    }
  }, [isOpen]);

  const startRecording = () => {
    if (recognitionRef.current) {
      setTranscript("");
      setParsedData(null);
      setIsRecording(true);
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Already started
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      processTranscript(transcript);
    }
  };

  const processTranscript = (text: string) => {
    if (!text.trim()) return;
    const parsed = parseVoiceInput(text);
    setParsedData(parsed);

    // Check for anomalies if amount and category are present
    if (parsed.amount && parsed.category && parsed.type === "expense") {
      const warning = checkAnomaly(parsed.amount, parsed.category, getTransactions());
      setAnomalyWarning(warning);
    }
  };

  const handleConfirm = () => {
    if (!parsedData || !parsedData.amount || !parsedData.type || !parsedData.category) return;

    if (parsedData.personName) {
      const entryType = parsedData.type === "expense" ? "gave" : "got";
      const entryDesc = `${entryType === "gave" ? "Gave to" : "Got from"} ${parsedData.personName}`;

      const tx = addTransaction({
        amount: parsedData.amount,
        type: parsedData.type,
        category: "Ledger",
        description: `${entryDesc}: ${parsedData.description}`,
      });

      const customers = getLedgerCustomers();
      const existing = customers.find(
        (c) => c.name.toLowerCase() === parsedData.personName!.toLowerCase()
      );

      const ledgerEntry = {
        id: generateId(),
        amount: parsedData.amount,
        type: entryType as "gave" | "got",
        description: parsedData.description || "Voice entry",
        date: tx.date,
        txId: tx.id,
      };

      const balanceAdj = entryType === "gave" ? parsedData.amount : -parsedData.amount;

      if (existing) {
        const updated: LedgerCustomer = {
          ...existing,
          balance: existing.balance + balanceAdj,
          history: [ledgerEntry, ...existing.history],
        };
        setLedgerCustomers(customers.map((c) => (c.id === existing.id ? updated : c)));
      } else {
        const newCust: LedgerCustomer = {
          id: generateId(),
          name: parsedData.personName,
          phone: "",
          balance: balanceAdj,
          history: [ledgerEntry],
        };
        setLedgerCustomers([newCust, ...customers]);
      }
    } else {
      addTransaction({
        amount: parsedData.amount,
        type: parsedData.type,
        category: parsedData.category,
        description: parsedData.description || `Voice entry: ${parsedData.category}`,
      });
    }

    setSuccess(true);
    setTimeout(() => {
      onClose();
      if (onSuccess) onSuccess();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="w-full bg-card border-t md:border border-border rounded-t-3xl md:rounded-2xl max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-background-subtle">
          <h3 className="text-base font-black text-foreground flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            Voice Logging
          </h3>
          <div className="flex items-center gap-3">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-secondary text-foreground text-xs font-bold px-2 py-1.5 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="hi-IN">Hindi</option>
              <option value="en-US">English</option>
              <option value="mr-IN">Marathi</option>
              <option value="ta-IN">Tamil</option>
              <option value="te-IN">Telugu</option>
              <option value="bn-IN">Bengali</option>
              <option value="gu-IN">Gujarati</option>
              <option value="kn-IN">Kannada</option>
              <option value="ml-IN">Malayalam</option>
            </select>
            <button
              onClick={onClose}
              className="text-icon-muted hover:text-icon-active p-1 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-success-light text-success flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-foreground text-lg">Voice Entry Saved</h4>
            </div>
          ) : (
            <>
              {/* Animation & Mic Status */}
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="relative flex items-center justify-center w-24 h-24">
                  {isRecording && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping duration-1000"></div>
                      <div className="absolute inset-2 rounded-full bg-primary/30 animate-pulse duration-700"></div>
                    </>
                  )}
                  <button 
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-transform ${
                      isRecording ? "bg-primary scale-110" : "bg-primary/80 hover:bg-primary"
                    }`}
                  >
                    {isRecording ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-6 h-6" />}
                  </button>
                </div>
                <p className="text-sm font-bold text-foreground-secondary">
                  {isRecording ? "Listening... (Tap to stop)" : "Tap mic to start"}
                </p>
              </div>

              {/* Transcript Display */}
              <div className="bg-secondary p-4 rounded-xl border border-border min-h-[80px] flex items-center justify-center text-center">
                <p className="text-sm font-medium text-foreground italic">
                  {transcript || (isRecording ? "Speak now..." : "No speech detected.")}
                </p>
              </div>

              {/* Parsed Result & Confirmation */}
              {parsedData && !isRecording && (
                <div className="space-y-4 animate-in slide-in-from-bottom-2">
                  <div className="p-4 border border-border rounded-xl space-y-3 bg-background">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground-secondary border-b border-border pb-2">
                      Parsed Entry
                    </h4>
                    
                    {parsedData.amount ? (
                      <div className="space-y-3">
                        {parsedData.personName && (
                          <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg">
                            <BookOpen className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase">
                              Ledger: {parsedData.type === "expense" ? "Gave to" : "Got from"} {parsedData.personName}
                            </span>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="block text-[10px] uppercase text-foreground-muted font-bold">Amount</span>
                            <span className={`text-lg font-black ${parsedData.type === 'income' ? 'text-success' : 'text-error'}`}>
                              {formatAmount(parsedData.amount, "INR")}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase text-foreground-muted font-bold">
                              {parsedData.personName ? "Person" : "Category"}
                            </span>
                            <span className="text-sm font-bold text-foreground">
                              {parsedData.personName || parsedData.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-error font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Could not detect amount. Please try again.
                      </p>
                    )}
                  </div>

                  {anomalyWarning && (
                    <div className="bg-warning-light text-warning p-3 rounded-xl border border-warning/20 flex items-start gap-2 text-xs font-bold">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{anomalyWarning}</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => { setTranscript(""); setParsedData(null); startRecording(); }} className="btn-secondary flex-1">
                      Retry
                    </button>
                    <button 
                      onClick={handleConfirm} 
                      disabled={!parsedData.amount}
                      className="btn-primary flex-1 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
