"use client";

import { useState } from "react";
import Button from "@/app/_components/ui/Button";
import { useToast } from "@/app/_components/ui/Toast";
import { supabase } from "@/lib/supabase/client";

interface BugReportFormProps {
  userId: string;
  userEmail?: string | null;
  onSent?: () => void;
}

export default function BugReportForm({ userId, userEmail, onSent }: BugReportFormProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!message.trim() || message.trim().length < 10) {
      toast("Décrivez votre problème (min. 10 caractères)", "error");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      user_id: userId,
      user_email: userEmail || null,
      message: message.trim(),
    });

    if (error) {
      toast("Impossible d'envoyer. Réessayez.", "error");
    } else {
      toast("Message envoyé ! Nous reviendrons vers vous.", "success");
      setMessage("");
      onSent?.();
    }
    setSending(false);
  }

  return (
    <div className="bg-surface-container rounded-xl p-4">
      <p className="text-[13px] font-medium text-on-surface mb-1">Signaler un bug</p>
      <p className="text-[12px] text-on-surface-variant mb-3">Décrivez le problème rencontré et nous le corrigerons rapidement.</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Décrivez votre problème..."
        className="w-full bg-surface-container-high border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant outline-none focus:border-primary resize-none h-24"
      />
      <Button variant="primary" size="md" className="w-full mt-3" onClick={handleSend} disabled={sending || message.trim().length < 10}>
        {sending ? "Envoi..." : "Envoyer"}
      </Button>
    </div>
  );
}
