# Inventário de `_material/` — o que já existe, antes de escrever qualquer coisa

**Para que serve:** `_material/dados-sasi-para-analise/` guarda 3 anos de doutrina clínica, design e código do
SASI v1/v2. Quase toda peça clínica ou visual que o v3 precisa **já foi escrita e testada em plantão**. Este
arquivo diz onde cada uma está, para ninguém reescrever do zero.

Levantado em 07-ago-2026 por leitura de **126 arquivos** em 5 corpos. Caminhos são relativos a
`_material/dados-sasi-para-analise/`. `_material/` está fora do git (tem dado real de paciente).

**Como usar:** achou a peça aqui? Leia o arquivo original antes de digitar. O que está aqui é mapa, não conteúdo —
e mapa envelhece. Confirme com `ls` e abra a fonte.

---

## 1. Regra clínica — o que o v3 não tem e o material tem

| O que | Onde | Por que importa |
|---|---|---|
| **25 regras de alerta com fonte/DOI** (PAM, PAS, FC, FR, SpO2, lactato, GCS, HT, UR) + 4 pendentes de validação (glicemia, K, Na, temp) | `arquivos-sasi/sasi-decisoes.md` | Única fonte com evidência citada (ACC 2025, Crit Care 2021, SSC 2017) para popular `alert_rules`. Hoje a tabela nasce **vazia** e nenhum alerta dispara |
| **Ruleset SOFA congelado** `SOFA1_v1.0` — 6 sistemas, imputação determinística, trilha de auditoria | `arquivos-sasi/sasi-sofa-ruleset.md` | Spec mais completa das 3 versões de SOFA no material; as outras cobrem 4 de 6 sistemas ou não têm imputação |
| **SOFA já em SQL** — view `vw_sofa_diario` v0.2 | `EXTRACAO-CLINICA-SASI/sasi (cópia)/supabase/migrations/20260630190000_update_vw_sofa_diario_v02.sql` | A migration do v3 declara essa view OMITIDA (linha 752, confirmado). É a peça de cálculo que o schema não trouxe |
| **SOFA em TypeScript com 7 bugs P0 corrigidos**: PAM usa o MÍNIMO · neuro suprimido sob sedação · resp 3/4 exige VM ativa · renal cruza creatinina × diurese × TRRC | `SASI-DESING-E_MOTOR-CLINICO-v2 (cópia)/sasi-motor-clinico-v2/sofa.ts` | Cada bug é armadilha que volta se o v3 reescrever do zero. **Código marcado STAGING, não compila** — vale a regra, não o arquivo |
| **Sepsis-3 correto**: ΔSOFA ≥ 2, não SOFA absoluto; ATB profilático não conta como evidência de infecção | `SASI-DESING.../sasi-motor-clinico-v2/sepsis.ts` | Erro clássico é usar o SOFA absoluto. Fonte legível: Singer 2016, JAMA |
| **Cutoffs dos 7 sub-motores de alerta**: PAM<55 · lactato>4 · SpO2<88 · K⁺>6,0 · ΔCr≥0,3 · ROX<4,88 · glicemia<70 · meta calórica<60% | `SASI-DESING.../sasi-motor-clinico-v2/engine.ts` | Catálogo numérico mais concreto do material. Complementa, não duplica, o `sasi-decisoes.md` |
| **Regras de tendência com DOI**: AKI por creatinina (KDIGO), queda de GCS ≥2/24h (ERC-ESICM 2025) | `EXTRACAO-CLINICA-SASI/sasi (cópia)/supabase/migrations/20260626000400_tendencia.sql` | O v3 tem a tabela `trend_rules`, não tem o porquê nem as linhas |
| **ATB stewardship**: bandeira amarela ≥7 dias, vermelha ≥14 | `arquivos-sasi/sasi-decisoes.md` | Decisão já tomada pelo operador. Parte já está na view `vw_dias_atb_ativo` do v3 |
| **Motor hemodinâmico determinístico** (débito, RVS, PSAP, fluido-responsividade) com fonte primária de cada fórmula | `01-pacote-skills-medicas/hemodinamica-calculada/scripts/calc_hemo.py` (588 linhas) + `references/01-04` | Python puro, sem dependência do v2. Portável quase 1:1. Doutrina da casa: o LLM não faz aritmética |
| **Motor de balanço hídrico** com dicionário CANON (reclassifica diurese lançada como ganho) | `01-pacote-skills-medicas/sasi-ingest-export/scripts/build_passagem.py` (439 linhas) | Resolve estruturalmente o erro de LLM contar diurese como ingesta |
| **Red flags e cutoffs de ecocardiograma** (POCUS e laudo formal) | `01-pacote-skills-medicas/analise-ecott/references/01,02,03` | Regras citadas e usadas em plantão; evita repesquisar literatura |

## 2. Contrato de texto e de dados

| O que | Onde | Por que importa |
|---|---|---|
| **TEMPLATE-BASE CANÔNICO v2** — ortogonalidade de eixos: tempo (HPMA) · estado (EF) · problema (Impressão) · ação (Conduta) | Canônico: `EXTRACAO-CLINICA-SASI/sasi (cópia)/doctrine/_SASI_TEMPLATE_BASE_v2.md`. Cópias em `arquivos-sasi/sasi-skills-e-templates/template-evolucao-v2.md` e `01-pacote-skills-medicas/admissao-uti/SKILL.md` | Contrato de saída de toda nota clínica. Portar literalmente, não redesenhar. **Está em 3 lugares — usar o de `doctrine/`** |
| **Doutrina de estilo do texto clínico**: acentuação, CAPS só para sigla, setas ↑↓ proibidas, zero didática, conduta só com fonte | `01-pacote-skills-medicas/sasi-ingest-export/references/00-estilo-texto-clinico.md` | Derivado de auditoria das evoluções reais do operador — é a voz dele, não estilo genérico de LLM. **Existe só aqui** |
| **Dicionário de extração** por tipo de documento + armadilhas de OCR brasileiro (vírgula decimal, plaquetas ambíguas, µmol/L × mg/dL, gotas → mL/h) | `01-pacote-skills-medicas/sasi-ingest-export/references/02-extraction-dictionary.md` | Conhecimento caro de redescobrir. Duplicado em `arquivos-sasi/sasi-skills-e-templates/references/` |
| **Malha de sanidade fisiológica**: faixas por sistema, dose máxima de droga vasoativa, incompatibilidades. Princípio: **sinaliza, não corrige** | `01-pacote-skills-medicas/sasi-ingest-export/references/03-clinical-sanity-checks.md` | Camada de validação que hoje não tem onde morar no v3. É a fonte das faixas de `evento_tipo_ref` |
| **Formatos de passagem de turno**: A (1 paciente, SBAR) e B (painel 33 leitos, TOP 5 + agenda) | `01-pacote-skills-medicas/sasi-ingest-export/references/05-export-passagem-turno.md` | Tela já testada em plantão, com racional citado (Arora 2005) |
| **BRIEFING de extração**: diurese e BH somados célula a célula, nunca o total manuscrito; toda flag com limiar numérico | `EXTRACAO-CLINICA-SASI/BRIEFING.md` | Impede confiar no total escrito à mão pela enfermagem |
| **Armadilhas da folha física** de enfermagem: FR × FC invertidos, PAM entre parênteses é o valor confiável | `01-pacote-skills-medicas/controles-vitais-janela/references/mapa-folha.md` | Conhecimento tácito de campo |
| **Contratos JSONB** (dispositivos, riscos_flags, patient_summary, sistemas Máx–Mín, dvas, prescricao) | `EXTRACAO-CLINICA-SASI/sasi (cópia)/sasi-v2/src/types/clinical.ts` (578 linhas, o mais completo) | O schema do v3 tem os campos flexíveis, não o formato de dentro deles. Já parcialmente portado em `src/types/clinical.ts` |
| **`payload-example.json`** — fixture SEM dado real | `01-pacote-skills-medicas/sasi-ingest-export/assets/payload-example.json` | Serve de semente de teste de integração sem risco de PHI |

### Conflito de fonte já resolvido: setas ↑↓ são PROIBIDAS

Duas fontes do material se contradizem. **Vence `00-estilo-texto-clinico.md`**, porque ele saiu de auditoria
das evoluções reais do operador; o `readme.md` do design system é convenção genérica de UI.

| Fonte | Diz | Vale? |
|---|---|---|
| `01-pacote-skills-medicas/sasi-ingest-export/references/00-estilo-texto-clinico.md` | seta ↑ ↓ = **proibida** em texto clínico | **SIM** |
| `SASI-DESING.../sasi-design-system/readme.md` | "vetor ↑/↓/=" no problema ativo | não — revogada |

Escreva a direção em palavra: "lactato em queda", "creatinina subindo", "PAM estável". Nunca o símbolo.

## 3. Duas doutrinas de segurança nascidas de incidente real

| Incidente | Correção | Onde |
|---|---|---|
| "µ" digitado em maiúscula vira "Μ" (mi grego) → **noradrenalina lida 1000× maior** | `unidadeSegura()` | `EXTRACAO-CLINICA-SASI/sasi (cópia)/sasi-v2/src/lib/formatters/br.ts` |
| Queda de rede aparecia na tela como "nenhum sinal vital lançado" | Falha de leitura do banco **sempre lança exceção**, nunca vira lista vazia | `.../sasi-v2/src/lib/data/erros.ts` |

Sem reimplementar as duas no v3, os mesmos incidentes voltam.

## 4. Design

| O que | Onde |
|---|---|
| Tokens de cor clínicos em hex: 5 níveis de gravidade, rampa do SOFA, 7 sistemas orgânicos, 7 selos de terapia | `SASI-DESING-E_MOTOR-CLINICO-v2 (cópia)/sasi-design-system/tokens/colors.css` |
| 13 componentes com contrato de API completo em `.prompt.md` (LeitoCard, VitalStat, ProblemRow, GravityBadge, TherapyBadge…) | `SASI-DESING.../sasi-design-system/` |
| Convenção de conteúdo pt-BR: conduta sempre com meta numérica | `SASI-DESING.../sasi-design-system/readme.md` — **a parte deste arquivo que pede "vetor ↑/↓/=" está REVOGADA**, ver o conflito abaixo |

## 5. Já resolvido no v3 — não migrar

- **Schema do banco**: 13 tabelas, 14 enums, 7 views, 41 policies. É cópia fiel de
  `SASI-V2v3/SASIv3planoeanexos/10_schema_producao_v3.sql`.
- **`evento_tipo_ref`** com 57 códigos, faixa fisiológica e LOINC nos 5 sinais vitais — já semeada.
- **RPC `save_ficha`** e os 9 gatilhos — já no schema aplicado.
- **RLS por dono** via `fn_owns_paciente`, 4 policies por tabela, sem `dev_bypass`.
- **Lógica de triagem** (`severidadeVisualDe`, `foraDaFaixa`, `acuidadeDe`, `triagem`, `diasTerapia`,
  `stewardshipFlag`, `imc`) — já portada em `src/lib/clinical/sasi.ts`, com 11 testes.
- **Tipos do domínio** — já portados em `src/types/clinical.ts`.

## 6. Escopo fechado por ordem do operador (31-jul-2026)

`SASI-V2v3/Planos de migração-sasi/plano-sasi-V3.2`, linhas 42-56 e 297-314 — **F3 (login/RLS produção)**,
**F4 (OCR dentro do app)** e **F5 (FHIR)** riscadas, com a nota de que nenhuma sessão futura deve propô-las de
novo. Só o arquivo **sem extensão** tem essa versão; os dois `.html` renderizam a versão antiga, com as fases
ainda ativas.

## 7. Lixo — 1,046 GB de 1,1 GB

| Item | Onde | Peso |
|---|---|---|
| `node_modules` do v2 (3 cópias: sasi-v2 532M · frontend 289M · mcp-server 115M) | `EXTRACAO-CLINICA-SASI/sasi (cópia)/` | **936 MB** |
| Cache de build do Next (`.next`) | `.../sasi-v2/.next` | **88 MB** |
| Histórico git do v2 (o repo vivo está no GitHub) | `.../sasi (cópia)/.git` | **22 MB** |
| `dist/` compilados · `.idea` da IDE · `.temp` do Supabase CLI | idem | ~2 MB |
| 3 gerações do mesmo mockup React "Mapa Tático" — **contêm nome real de paciente** | `arquivos-sasi/mapas-taticos-antigos/` | 180 KB |
| `Plano de Intergração com SASI.md` — 1.260 linhas de log de chat sobre Firebase, que não existe mais | idem | (dentro dos 180 KB) |
| 2 HTML do plano, byte-idênticos e desatualizados (mostram F3-F5 ativas) | `SASI-V2v3/Planos de migração-sasi/` | 43 KB |
| `starter-next/` — Next 15 + Tailwind 3, abandonado. **Exceção: `lib/sasi.ts` tem valor** (já portado) | `SASI-V2v3/SASIv3planoeanexos/starter-next/` | 72 KB |
| Saída de build do design system: `_ds_bundle.js` · `_ds_manifest.json` · `_adherence.oxlintrc.json` | `SASI-DESING.../sasi-design-system/` | 202 KB |
| `06-api-automation-prompts.md` — marcado no próprio arquivo "LEGADO — NÃO USAR" (24-jun-2026). Pipeline iOS Shortcut → Gemini → Edge Function, morto. Em 2 pastas | `01-pacote-skills-medicas/.../references/` e `arquivos-sasi/.../references/` | ~20 KB |
| `Planilha_SASI_V2_1(0.csv` — encoding corrompido, ~1.000 linhas vazias | `arquivos-sasi/sasi-planilhas-antigas/` | 3,4 KB |
| 5 `__init__.py` de 0 byte · 4 READMEs de Edge Function nunca implementada · 7 migrations em `_archive/` | vários | 0 a pouco |
| 6 arquivos duplicados entre `01-pacote-skills-medicas/sasi-ingest-export/references/` e `arquivos-sasi/sasi-skills-e-templates/references/` (01 a 06 + `SKILL.md`) | as 2 pastas | [SEM_FONTE] |

## 8. Dado real de paciente — 3 caminhos confirmados

Nenhum nome foi reproduzido neste inventário. Não abrir, não copiar para `src/` ou `tests/`, não colar em prompt.

- `01-pacote-skills-medicas/controles-vitais-janela/references/amostras/` — 3 arquivos com nome, prontuário, leito e prescrição
- `arquivos-sasi/mapas-taticos-antigos/Artefato Claude Mapa Tático V3.md` — 3 pacientes do plantão de 26-04-2026 como dado semente
- `arquivos-sasi/mapas-taticos-antigos/MAPA Tático.md` — 1 nome em texto de auditoria

## 9. NÃO VI — o que este inventário não cobre

| Ficou fora | Por quê |
|---|---|
| `SystemPanel.tsx` do v2 (806 linhas, maior arquivo de UI) | Pode ter validação de campo não capturada nos tipos |
| `eventos.ts`, `pacientes.ts`, `evolucoes.ts` do v2 em corpo completo | Só assinaturas por grep; agregação de série temporal pode ter lógica não documentada |
| ~40 componentes `.tsx` de UI pura e os 13 `.jsx` do design system | Sem decisão clínica; o contrato de API já foi lido nos `.prompt.md` |
| `schema-live-dump.sql` (429 linhas) e `20260626000000_baseline.sql` (1.290 linhas) | Schema pré-v3, superado |
| Os DOIs e PMIDs citados em `sasi-decisoes.md` e `sasi-sofa-ruleset.md` | As fontes estão **escritas**, não **verificadas**. Validar antes de uso à beira-leito |
| Qualquer código foi executado ou compilado | Reconhecimento é leitura |
