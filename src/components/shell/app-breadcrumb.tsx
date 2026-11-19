"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type Crumb = { label: string; href?: string };

const FIXED: Record<string, string> = {
  new: "Novo",
  edit: "Editar",
  aditivos: "Aditivos",
};

/** Trilha da rota atual. Segmentos sem página própria (ex.: "aditivos", "conta") não viram link. */
export function crumbsFor(pathname: string): Crumb[] {
  if (pathname === "/conta/senha") return [{ label: "Trocar senha" }];
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let href = "";
  parts.forEach((part, index) => {
    href += `/${part}`;
    const nav = index === 0 ? NAV_ITEMS.find((item) => item.href === href) : undefined;
    let label: string;
    let linkable = true;
    if (nav) label = nav.label;
    else if (/^\d+$/.test(part)) label = `#${part}`;
    else if (FIXED[part]) {
      label = FIXED[part];
      linkable = part !== "aditivos";
    } else label = decodeURIComponent(part).replace(/[_-]+/g, " ");
    crumbs.push({ label, href: linkable ? href : undefined });
  });
  return crumbs;
}

export function AppBreadcrumb() {
  const pathname = usePathname();
  const crumbs = crumbsFor(pathname);
  if (crumbs.length === 0) {
    return (
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">Início</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }
  const last = crumbs.length - 1;
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, index) => (
          <Fragment key={`${index}-${crumb.label}`}>
            {/* No celular só os dois últimos níveis aparecem. */}
            {index > 0 && <BreadcrumbSeparator className={index < last ? "hidden sm:inline-flex" : undefined} />}
            <BreadcrumbItem
              className={cn(
                index < last - 1 && "hidden sm:inline-flex",
                index < last ? "shrink-0" : "min-w-0",
              )}
            >
              {index === last ? (
                <BreadcrumbPage className="truncate font-medium tabular-nums">{crumb.label}</BreadcrumbPage>
              ) : !crumb.href ? (
                <span>{crumb.label}</span>
              ) : (
                <BreadcrumbLink className="tabular-nums" render={<Link href={crumb.href} />}>
                  {crumb.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
