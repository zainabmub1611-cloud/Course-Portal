"use client";

import { useI18n } from "@/lib/i18n/store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, Check } from "lucide-react";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className="gap-2 text-muted-foreground hover:text-foreground"
          aria-label="Switch language"
        >
          <Globe className="h-4 w-4" />
          {!compact && (
            <span className="text-sm font-medium">
              {lang === "en" ? "EN" : "ع"}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setLang("en")}
          className="gap-2 cursor-pointer"
        >
          <span className="text-base">🇬🇧</span>
          <span className="flex-1">English</span>
          {lang === "en" && <Check className="h-4 w-4 text-accent" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLang("ar")}
          className="gap-2 cursor-pointer"
        >
          <span className="text-base">🇴🇲</span>
          <span className="flex-1">العربية (عُمان)</span>
          {lang === "ar" && <Check className="h-4 w-4 text-accent" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
