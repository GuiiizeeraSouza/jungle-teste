"use client";

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const busca = value.trim();
    onOpenChange(false);
    void navigate({ to: "/", search: { busca: busca || undefined }, hash: "catalogo" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-24 translate-y-0 sm:max-w-xl">
        <DialogTitle>Buscar na Kurio</DialogTitle>
        <DialogDescription>Procure por nome do NFT, coleção ou categoria.</DialogDescription>
        <form role="search" onSubmit={submit} className="flex gap-2">
          <label htmlFor="busca-global" className="sr-only">
            Termo de busca
          </label>
          <Input
            id="busca-global"
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ex.: Emerald Ape, Kurio Nomads, Música…"
            className="h-10"
          />
          <Button type="submit" className="h-10">
            <Search aria-hidden />
            Buscar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
