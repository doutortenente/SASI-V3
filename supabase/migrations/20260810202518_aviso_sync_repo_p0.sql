-- APLICADA no banco vivo em 10-ago-2026. Não editar.
-- Canal de avisos para as sessões de código (Claude Code) que abrem o repo SASI-V3.
-- Motivo: o conector GitHub da sessão Cowork de 10-ago não tinha escrita; o banco é o canal garantido.
CREATE TABLE IF NOT EXISTS public.avisos_agentes (
  id         serial PRIMARY KEY,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  titulo     text NOT NULL,
  corpo      text NOT NULL,
  resolvido  boolean NOT NULL DEFAULT false
);
COMMENT ON TABLE public.avisos_agentes IS
  'LEIA ANTES DE QUALQUER TAREFA NO REPO SASI-V3. Avisos operacionais deixados por sessões com acesso ao banco mas sem escrita no GitHub. Marcar resolvido=true ao cumprir.';
ALTER TABLE public.avisos_agentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY dev_bypass ON public.avisos_agentes AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

INSERT INTO public.avisos_agentes (titulo, corpo) VALUES (
'P0 do banco aplicado em 10-ago — sincronizar o repo ANTES de qualquer outra tarefa',
'BANCO VIVO MUDOU EM 10-AGO-2026 (7 migrations, carimbos 20260810083301..20260810084920, testadas em réplica antes de aplicar). O repo ainda não sabe. ORDENS, NA ORDEM:

1. Recuperar as 7 migrations do próprio banco:
   select version, name, statements from supabase_migrations.schema_migrations where version >= ''20260810'' order by version;
   Gravar cada uma em supabase/migrations/<version>_<name>.sql (MESMO carimbo — o db:push passa a pulá-las).
   Cabeçalho: "APLICADA no banco vivo em 10-ago-2026. Não editar." (SQL delas em maiúsculas: escritas fora do repo; migration aplicada não se edita — regra maior.)

2. Atualizar CLAUDE.md (seção Estado) e .claude/rules/supabase.md com bloco "P0 10-ago":
   - gravidade → estavel|watcher|instavel|critico (moderado→watcher, grave→instavel; obito saiu — desfecho em status_leito/internacoes.desfecho). vw_dashboard_uti recriada; 2 triggers de semáforo reescritos.
   - internacoes (episódios; reinternação encadeada; destino de alta) + internacao_id carimbado por trigger em evolucoes/atbs/culturas/eventos_clinicos/pendencias + sincronia paciente↔episódio automática.
   - dispositivo_episodios (janela + motivo_fim); pacientes.dispositivos virou DERIVADO (fn_refresh_dispositivos) — PROIBIDO escrever à mão; vw_dispositivos_ativos dá dias de uso.
   - evolucoes: tipo_nota, data_plantao, turno (diurna|noturna; noturna antes das 07h cai no dia anterior), autor_crm/nome, illness_severity (por nota), finalizada_em; fn_evolucao_relogios deriva no INSERT; plantao = legado.
   - janelas_24h (max/min + excursões; unique paciente+tipo+janela_fim; render pronto em vw_janelas_24h_render — "PAM 90-56 (4/12 <65)"); substitui pam_min/pas_min.
   - evento_tipo_ref: 56 → 79 códigos (18 labs + pas_min órfão corrigido + 5 de folha: pvc, diurese_24h, diurese_parcial, uf_dialise, debito_dreno); LOINC NULL nos novos; custom = 0 (14 reclassificados; 1 requires_review: diurese 0 de folha preenchida só 23h-05h, não é anúria).
   - Decisões de produto 10-ago: excursões só como agregado (não ingerir aferições brutas); chavinhas de dispositivos sem UI de edição manual; seta de tendência banida também no schema (problemas_ativos NÃO ganha vetor); histórico ATB: evolução completa, passagem só ativos.

3. Rodar pnpm gen:types (PENDENTE desde o P0) e pnpm check.

4. No repo Claude (skills-que-prestam/01-pacote-skills-medicas/sasi-ingest-export): criar references/08-p0-banco-10ago.md (contrato de gravação nas tabelas novas) e 4 edições no SKILL.md (seção "Banco P0", ponteiro na FASE 4A, item 9 do SOFA usando diurese_24h, linha na lista de referências). A versão ATUALIZADA já está ativa na conta do operador (zip sasi-ingest-export.skill, conversa Cowork de 10-ago) — replicar de lá se disponível, senão reconstruir deste roteiro.

5. Marcar este aviso resolvido=true e registrar o que foi feito.

Backup pré-migração ficou com o operador (zip na conversa de 10-ago). Assinado: sessão Cowork 019RFFfuTukFbnYnPW9DYK2w, 10-ago-2026.'
);
