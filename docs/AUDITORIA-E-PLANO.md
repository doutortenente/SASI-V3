# Auditoria técnica do material (`_material/`) e plano de organização no SASI v3

Data: 07-ago-2026. Fonte: varredura completa por 3 agentes de reconhecimento + verificação direta.
Números medidos, não estimados.

## 1. O que existe em `_material/` (1,9 GB, 4 pastas)

| Pasta | Tamanho | Veredito |
|---|---|---|
| `dados-sasi-para-analise/` | 1,1 GB | mistura: 85% peso morto + o ouro do projeto |
| `typescript-sdk/` | 789 MB | clone do SDK oficial de MCP — referência, não é nosso código |
| `04-pacote-skills-supabase-e-vercel/` | 376 KB | 4 skills (supabase, postgres-best-practices, automation, vercel-cli) |
| `context7-cli-docs-mcp/` | 4 KB | resíduo vazio |

### 1.1 O peso morto (descartável sem perda)

| Item | Tamanho | Por quê |
|---|---|---|
| `node_modules/` (3×, dentro do clone `sasi (cópia)/`) | 936 MB | dependência reinstalável |
| `.next/` (cache de build) | 88 MB | regenerável |
| `frontend/` (app Vite aposentado 31-jul) | 291 MB | sem `package.json`, sem `src/` — só sobra |
| `.git/` do clone | 22 MB | histórico já vive no GitHub `doutortenente/SASI` |
| 7 symlinks quebrados na raiz de `EXTRACAO-CLINICA-SASI/` | — | apontam pra caminho inexistente |
| `typescript-sdk/` | 789 MB | clonável de novo quando precisar |

**Total recuperável: ~2,1 GB dos 1,9 GB visíveis** (o clone tem repetição interna).

### 1.2 O ouro (já resgatado para o repo novo ✅)

| Origem em `_material/` | Destino no v3 | Estado |
|---|---|---|
| `SASI-V2v3/SASIv3planoeanexos/10_schema_producao_v3.sql` (757 linhas: 13 tabelas, 14 enums, 7 views, 41 policies RLS, 9 triggers) | `supabase/migrations/20260807000000_schema_inicial_v3.sql` | ✅ copiado |
| `starter-next/lib/database.types.ts` (311 linhas, tipos de domínio) | `src/types/clinical.ts` | ✅ copiado |
| `starter-next/lib/sasi.ts` (69 linhas: imc, triagem, acuidade, stewardship) | `src/lib/clinical/sasi.ts` | ✅ copiado + 11 testes |
| Design system `sasi-design-system/tokens/*.css` (2 temas, escala de gravidade, 7 cores de sistema) | `src/styles/globals.css` (bloco `@theme`) | ✅ portado pra Tailwind 4 |

### 1.3 O ouro pendente (migrar nas próximas fases)

| Item | Onde está | Destino | Condição |
|---|---|---|---|
| Motor clínico v2: `getSOFA()` (`sofa.ts:35`), `assessSepsis()` (`sepsis.ts:27`), `runAllAlerts()` (`engine.ts:60`) | `SASI-DESING-E_MOTOR-CLINICO-v2 (cópia)/sasi-motor-clinico-v2/` | `src/lib/clinical/{sofa,sepsis}.ts` + `src/features/alerts/` | ⚠️ **NÃO COMPILA** — extraído de PDF, faltam 9 módulos de dependência. Recriar módulo a módulo COM teste, nunca colar às cegas |
| 11 componentes do design system (LeitoCard, SofaBadge, GravityBadge, VitalStat, SystemPanel…) | `sasi-design-system/components/{core,clinical}/` | `src/components/shared/` | usar como spec visual; reescrever sobre shadcn/ui, não copiar `.jsx` |
| 3 templates de tela (dashboard, ficha, passagem) + UI-kit interativo | `sasi-design-system/templates/`, `ui_kits/comando-uti/` | referência de layout das rotas `/`, `/patients/[id]`, `/rounds` | só leitura |
| Views/queries do app v2 real (`sasi-v2/src/lib/data/`, 8 arquivos) | clone em `EXTRACAO-CLINICA-SASI/sasi (cópia)/sasi-v2/` | `src/features/*/services/` | portar query a query conforme cada tela nascer |
| `CalcPanel.tsx` (398 linhas: dose de DVA mcg/kg/min, PAM, P/F, diurese ml/kg/h) | `sasi (cópia)/sasi-v2/src/features/war-room/` | extrair cálculo pra `src/lib/clinical/hemodinamica.ts` + teste; UI refeita | fase War Room |
| `calc_hemo.py` (588 linhas, motor hemodinâmico) e `build_passagem.py` (439 linhas, passagem determinística) | `01-pacote-skills-medicas/` | continuam como skills Python (pipeline de ingestão) — **não** viram código do app | sem ação |
| `sasi-sofa-ruleset.md` (spec congelada SOFA1_v1.0, cutoffs Sepsis-3) | `arquivos-sasi/` | `docs/` quando o SOFA for implementado — é o contrato de aceite dos testes | fase SOFA |
| `11_migracao_do_vivo.sql` (218 linhas, delta pro banco v2 vivo) | `SASIv3planoeanexos/` | só relevante se formos importar os pacientes do banco velho | decisão futura |

### 1.4 PHI — dado real de paciente ⚠️

4 arquivos em `_material/dados-sasi-para-analise/01-pacote-skills-medicas/controles-vitais-janela/references/amostras/` e `exemplo-resolvido.md` contêm dado identificável real (nome, prontuário, leito).

**Contenção aplicada:** `_material/`, `**/amostras/` e `90-PHI-LOCAL/` estão no `.gitignore` — nada disso entra em commit. Regra no `AGENTS.md`: nunca copiar amostra pra `src/` ou `tests/`.

## 2. Como o v3 está organizado (o que já é fato)

```
SASI-V3-SEM_MIGUE/
├── src/
│   ├── app/            # rotas: / (war-room), beds/, patients/, rounds/, api/
│   ├── features/       # 10 domínios: beds, patients, hemodynamics, sepsis,
│   │                   #   devices, sofa, war-room, rounds, exports, alerts
│   ├── components/     # ui/ (shadcn) + shared/ (nossos)
│   ├── lib/            # supabase/, clinical/, formatters/, constants/, utils/
│   ├── hooks/ stores/ types/ styles/
│   └── middleware.ts   # renovação de sessão Supabase
├── supabase/           # migrations/ (schema v3 completo) + functions/
├── tests/              # unit/ (Vitest) + e2e/ (Playwright)
├── docs/ scripts/ public/ .github/
└── _material/          # análise v2→v3 — FORA do git (PHI)
```

Verificado nesta data: `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` 11/11 ✅ · `pnpm build` ✅.

## 3. Sequência de fases (do RUNBOOK v3, adaptada ao banco novo)

| Fase | Entrega | Insumo de `_material/` |
|---|---|---|
| F0 ✅ | esqueleto + schema como migration + lógica base testada | feito hoje |
| F1 | aplicar migration no projeto Supabase novo (`fpemjplgtyhztowwemfz`) + `pnpm gen:types` + login | `RUNBOOK-migracao-v3.md` |
| F2 | War Room: grid de leitos sobre `vw_dashboard_uti` + realtime | design system (LeitoCard) + `triagem()` já portada |
| F3 | Ficha do paciente (evolução por sistemas) + pendências | templates ficha + queries do v2 |
| F4 | SOFA/Sepsis-3: recriar motor v2 módulo a módulo com Vitest | `sofa.ts`/`sepsis.ts` do motor + `sasi-sofa-ruleset.md` como contrato |
| F5 | Alertas (`alert_rules`/`trend_rules` já existem no schema) + stewardship | `engine.ts` do motor como referência |
| F6 | Passagem de plantão + exports | `build_passagem.py` como spec do formato |

## 4. Recomendação de faxina (aguarda ordem — deleção é decisão do operador)

1. `_material/dados-sasi-para-analise/EXTRACAO-CLINICA-SASI/sasi (cópia)/` → apagar `node_modules/`, `.next/`, `frontend/`, `.git/` (−1,3 GB; o código útil que sobra são ~200 KB já mapeados acima).
2. `_material/typescript-sdk/` → apagar (−789 MB; `git clone` recupera em minutos se precisar).
3. 7 symlinks quebrados → apagar.
4. Skills de `04-pacote-skills-supabase-e-vercel/` → avaliar mover pra `~/projetos/claude/skills/` (casa canônica) em vez de morar aqui.

**Nada disso foi executado.** Disco em 78% — a faxina liberaria ~2 GB.
