"use client";

import { useState } from "react";
import { EntityList } from "@/components/crud/entity-list";
import { BreadcrumbOverride } from "@/components/shell/app-breadcrumb";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { prestacaoContas } from "@/lib/entities/prestacao_contas";

type Situacao = "pendentes" | "realizadas";

/** Abas Pendentes/Realizadas sobre a lista do kit; a aba escolhida vai para a URL (`?situacao=`). */
export function PrestacaoLista({ situacaoInicial }: { situacaoInicial: Situacao }) {
  const [situacao, setSituacao] = useState<Situacao>(situacaoInicial);
  const label = prestacaoContas.situacoes.find((s) => s.value === situacao)!.label;

  const trocar = (value: unknown) => {
    const next: Situacao = value === "realizadas" ? "realizadas" : "pendentes";
    setSituacao(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "pendentes") params.delete("situacao");
    else params.set("situacao", next);
    const qs = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="min-w-0 space-y-4">
      <BreadcrumbOverride pathname="/prestacao_contas" append={label} />
      <Tabs value={situacao} onValueChange={trocar}>
        <TabsList aria-label="Situação da prestação de contas">
          {prestacaoContas.situacoes.map((s) => (
            <TabsTrigger key={s.value} value={s.value} className="px-3">
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {/* `key`: trocar de aba volta à página 1 (o kit não reinicia a página quando `extraParams` muda). */}
      <EntityList
        key={situacao}
        title={prestacaoContas.title}
        api={prestacaoContas.api}
        basePath={prestacaoContas.basePath}
        columns={prestacaoContas.columns}
        filters={prestacaoContas.filters}
        searchPlaceholder="Buscar na coluna escolhida"
        canCreate={false}
        rowHref={prestacaoContas.rowHref}
        pageSize={prestacaoContas.pageSize}
        extraParams={{ situacao }}
      />
    </div>
  );
}
