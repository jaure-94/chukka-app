import { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Mail, Plus, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecipientInputProps {
  recipients: string[];
  onRecipientsChange: (recipients: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function RecipientInput({ 
  recipients, 
  onRecipientsChange, 
  placeholder = "Enter email address...",
  className 
}: RecipientInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState("");

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const addRecipient = (email: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail) {
      setInputError("Please enter an email address");
      return;
    }
    
    if (!validateEmail(trimmedEmail)) {
      setInputError("Please enter a valid email address");
      return;
    }
    
    if (recipients.includes(trimmedEmail)) {
      setInputError("This email address is already added");
      return;
    }
    
    onRecipientsChange([...recipients, trimmedEmail]);
    setInputValue("");
    setInputError("");
  };

  const removeRecipient = (emailToRemove: string) => {
    onRecipientsChange(recipients.filter(email => email !== emailToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addRecipient(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && recipients.length > 0) {
      // Remove last recipient when backspacing on empty input
      removeRecipient(recipients[recipients.length - 1]);
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (inputError) {
      setInputError("");
    }
    
    // Auto-add email if user types comma or semicolon
    if (value.includes(',') || value.includes(';')) {
      const emails = value.split(/[,;]/).map(email => email.trim()).filter(Boolean);
      emails.forEach(email => {
        if (email && !recipients.includes(email.toLowerCase())) {
          if (validateEmail(email)) {
            onRecipientsChange([...recipients, email.toLowerCase()]);
          }
        }
      });
      setInputValue("");
    }
  };

  const handleAddClick = () => {
    addRecipient(inputValue);
  };

  // Predefined common recipients for quick selection
  const commonRecipients = [
    "captain@maritime.com",
    "operations@maritime.com",
    "dispatch@maritime.com",
    "manager@maritime.com"
  ];

  const availableCommon = commonRecipients.filter(email => !recipients.includes(email));

  return (
    <div className={cn("space-y-3", className)}>
      {/* Current Recipients */}
      {recipients.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Recipients ({recipients.length})
          </Label>
          <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg min-h-[60px] max-h-48 overflow-y-auto">
            {recipients.map((email, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors shrink-0"
              >
                <Mail className="h-3 w-3" />
                <span className="max-w-[200px] truncate">{email}</span>
                <button
                  type="button"
                  onClick={() => removeRecipient(email)}
                  className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-700 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="email"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={cn(
                "transition-all duration-200",
                inputError 
                  ? "border-red-500 focus-visible:ring-red-500" 
                  : "focus-visible:ring-blue-500"
              )}
            />
            {inputError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                <X className="h-3 w-3" />
                {inputError}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddClick}
            disabled={!inputValue.trim()}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Add</span>
          </Button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Press Enter or comma to add multiple recipients
        </p>
      </div>

      {/* Quick Add Common Recipients */}
      {availableCommon.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <UserPlus className="h-3 w-3" />
            Quick Add
          </Label>
          <div className="flex flex-wrap gap-2">
            {availableCommon.slice(0, 4).map((email) => (
              <button
                key={email}
                type="button"
                onClick={() => addRecipient(email)}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                {email}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile-friendly recipient count */}
      <div className="sm:hidden">
        {recipients.length > 0 && (
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg">
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span>{recipients.length} recipient{recipients.length !== 1 ? 's' : ''} added</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}