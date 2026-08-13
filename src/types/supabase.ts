export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_rules: {
        Row: {
          ativo: boolean
          comparador: Database["public"]["Enums"]["comparador_enum"]
          created_at: string
          fonte: string | null
          id: string
          limiar: number
          mensagem: string
          ordem: number
          rotulo: string
          severidade: Database["public"]["Enums"]["severidade_alerta_enum"]
          tipo_evento: string
        }
        Insert: {
          ativo?: boolean
          comparador: Database["public"]["Enums"]["comparador_enum"]
          created_at?: string
          fonte?: string | null
          id?: string
          limiar: number
          mensagem: string
          ordem?: number
          rotulo: string
          severidade: Database["public"]["Enums"]["severidade_alerta_enum"]
          tipo_evento: string
        }
        Update: {
          ativo?: boolean
          comparador?: Database["public"]["Enums"]["comparador_enum"]
          created_at?: string
          fonte?: string | null
          id?: string
          limiar?: number
          mensagem?: string
          ordem?: number
          rotulo?: string
          severidade?: Database["public"]["Enums"]["severidade_alerta_enum"]
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_tipo_fk"
            columns: ["tipo_evento"]
            isOneToOne: false
            referencedRelation: "evento_tipo_ref"
            referencedColumns: ["codigo"]
          },
        ]
      }
      alerts_log: {
        Row: {
          acked: boolean
          acked_at: string | null
          acked_by: string | null
          created_at: string
          evento_id: string | null
          hash_key: string
          id: string
          mensagem: string
          paciente_id: string
          payload: Json | null
          severidade: Database["public"]["Enums"]["severidade_alerta_enum"]
          tipo: string
          user_id: string | null
        }
        Insert: {
          acked?: boolean
          acked_at?: string | null
          acked_by?: string | null
          created_at?: string
          evento_id?: string | null
          hash_key: string
          id?: string
          mensagem: string
          paciente_id: string
          payload?: Json | null
          severidade?: Database["public"]["Enums"]["severidade_alerta_enum"]
          tipo: string
          user_id?: string | null
        }
        Update: {
          acked?: boolean
          acked_at?: string | null
          acked_by?: string | null
          created_at?: string
          evento_id?: string | null
          hash_key?: string
          id?: string
          mensagem?: string
          paciente_id?: string
          payload?: Json | null
          severidade?: Database["public"]["Enums"]["severidade_alerta_enum"]
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_log_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_clinicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_log_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "vw_eventos_pendentes_revisao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_log_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_log_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
      antibiograma: {
        Row: {
          antibiotico: string
          cim: number | null
          created_at: string
          cultura_id: string
          id: string
          resultado: Database["public"]["Enums"]["antibiograma_resultado_enum"]
        }
        Insert: {
          antibiotico: string
          cim?: number | null
          created_at?: string
          cultura_id: string
          id?: string
          resultado: Database["public"]["Enums"]["antibiograma_resultado_enum"]
        }
        Update: {
          antibiotico?: string
          cim?: number | null
          created_at?: string
          cultura_id?: string
          id?: string
          resultado?: Database["public"]["Enums"]["antibiograma_resultado_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "antibiograma_cultura_id_fkey"
            columns: ["cultura_id"]
            isOneToOne: false
            referencedRelation: "culturas"
            referencedColumns: ["id"]
          },
        ]
      }
      atbs: {
        Row: {
          agente_alvo: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string
          dose: string | null
          droga: string
          duracao_planejada_dias: number | null
          foco: string | null
          frequencia: string | null
          id: string
          intencao: Database["public"]["Enums"]["intencao_atb_enum"] | null
          internacao_id: string | null
          motivo_suspensao: string | null
          paciente_id: string
          updated_at: string
          user_id: string | null
          via: Database["public"]["Enums"]["via_atb_enum"] | null
        }
        Insert: {
          agente_alvo?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          dose?: string | null
          droga: string
          duracao_planejada_dias?: number | null
          foco?: string | null
          frequencia?: string | null
          id?: string
          intencao?: Database["public"]["Enums"]["intencao_atb_enum"] | null
          internacao_id?: string | null
          motivo_suspensao?: string | null
          paciente_id: string
          updated_at?: string
          user_id?: string | null
          via?: Database["public"]["Enums"]["via_atb_enum"] | null
        }
        Update: {
          agente_alvo?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          dose?: string | null
          droga?: string
          duracao_planejada_dias?: number | null
          foco?: string | null
          frequencia?: string | null
          id?: string
          intencao?: Database["public"]["Enums"]["intencao_atb_enum"] | null
          internacao_id?: string | null
          motivo_suspensao?: string | null
          paciente_id?: string
          updated_at?: string
          user_id?: string | null
          via?: Database["public"]["Enums"]["via_atb_enum"] | null
        }
        Relationships: [
          {
            foreignKeyName: "atbs_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atbs_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atbs_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
      avisos_agentes: {
        Row: {
          corpo: string
          criado_em: string
          id: number
          resolvido: boolean
          titulo: string
        }
        Insert: {
          corpo: string
          criado_em?: string
          id?: number
          resolvido?: boolean
          titulo: string
        }
        Update: {
          corpo?: string
          criado_em?: string
          id?: number
          resolvido?: boolean
          titulo?: string
        }
        Relationships: []
      }
      culturas: {
        Row: {
          agente: string | null
          coleta_ts: string
          created_at: string
          crescimento: boolean
          id: string
          internacao_id: string | null
          laudo_ts: string | null
          material: Database["public"]["Enums"]["material_cultura_enum"]
          observacoes: string | null
          paciente_id: string
          ufc_por_ml: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agente?: string | null
          coleta_ts: string
          created_at?: string
          crescimento?: boolean
          id?: string
          internacao_id?: string | null
          laudo_ts?: string | null
          material: Database["public"]["Enums"]["material_cultura_enum"]
          observacoes?: string | null
          paciente_id: string
          ufc_por_ml?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agente?: string | null
          coleta_ts?: string
          created_at?: string
          crescimento?: boolean
          id?: string
          internacao_id?: string | null
          laudo_ts?: string | null
          material?: Database["public"]["Enums"]["material_cultura_enum"]
          observacoes?: string | null
          paciente_id?: string
          ufc_por_ml?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "culturas_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "culturas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "culturas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
      dispositivo_episodios: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
          internacao_id: string | null
          motivo_fim:
            | Database["public"]["Enums"]["dispositivo_motivo_fim_enum"]
            | null
          observacoes: string | null
          paciente_id: string
          sitio: string | null
          source_text: string | null
          tipo: Database["public"]["Enums"]["dispositivo_tipo_enum"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          id?: string
          internacao_id?: string | null
          motivo_fim?:
            | Database["public"]["Enums"]["dispositivo_motivo_fim_enum"]
            | null
          observacoes?: string | null
          paciente_id: string
          sitio?: string | null
          source_text?: string | null
          tipo: Database["public"]["Enums"]["dispositivo_tipo_enum"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          internacao_id?: string | null
          motivo_fim?:
            | Database["public"]["Enums"]["dispositivo_motivo_fim_enum"]
            | null
          observacoes?: string | null
          paciente_id?: string
          sitio?: string | null
          source_text?: string | null
          tipo?: Database["public"]["Enums"]["dispositivo_tipo_enum"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispositivo_episodios_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivo_episodios_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivo_episodios_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
      evento_tipo_ref: {
        Row: {
          ativo: boolean
          categoria: string
          codigo: string
          faixa_max: number | null
          faixa_min: number | null
          loinc_code: string | null
          ordem: number
          rotulo: string
          unidade_padrao: string | null
        }
        Insert: {
          ativo?: boolean
          categoria: string
          codigo: string
          faixa_max?: number | null
          faixa_min?: number | null
          loinc_code?: string | null
          ordem?: number
          rotulo: string
          unidade_padrao?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          codigo?: string
          faixa_max?: number | null
          faixa_min?: number | null
          loinc_code?: string | null
          ordem?: number
          rotulo?: string
          unidade_padrao?: string | null
        }
        Relationships: []
      }
      eventos_clinicos: {
        Row: {
          confidence: number | null
          created_at: string
          evolucao_id: string | null
          fonte: Database["public"]["Enums"]["fonte_evento_enum"]
          id: string
          internacao_id: string | null
          paciente_id: string
          requires_review: boolean
          source_text: string | null
          tipo: string
          ts: string
          unidade: string | null
          user_id: string | null
          valor_json: Json | null
          valor_num: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          evolucao_id?: string | null
          fonte: Database["public"]["Enums"]["fonte_evento_enum"]
          id?: string
          internacao_id?: string | null
          paciente_id: string
          requires_review?: boolean
          source_text?: string | null
          tipo: string
          ts: string
          unidade?: string | null
          user_id?: string | null
          valor_json?: Json | null
          valor_num?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          evolucao_id?: string | null
          fonte?: Database["public"]["Enums"]["fonte_evento_enum"]
          id?: string
          internacao_id?: string | null
          paciente_id?: string
          requires_review?: boolean
          source_text?: string | null
          tipo?: string
          ts?: string
          unidade?: string | null
          user_id?: string | null
          valor_json?: Json | null
          valor_num?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_clinicos_evolucao_id_fkey"
            columns: ["evolucao_id"]
            isOneToOne: false
            referencedRelation: "evolucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_clinicos_evolucao_id_fkey"
            columns: ["evolucao_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["evolucao_id"]
          },
          {
            foreignKeyName: "eventos_clinicos_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "eventos_tipo_fk"
            columns: ["tipo"]
            isOneToOne: false
            referencedRelation: "evento_tipo_ref"
            referencedColumns: ["codigo"]
          },
        ]
      }
      evolucoes: {
        Row: {
          autor_crm: string | null
          autor_nome: string | null
          conduta: string[]
          condutas_sistemas: Json
          created_at: string
          data_evolucao: string
          data_plantao: string
          dvas: Json
          finalizada_em: string | null
          hemato: Json
          hemo: Json
          id: string
          illness_severity: Database["public"]["Enums"]["gravidade_enum"] | null
          impressao: string[]
          infecto: Json
          intercorrencias: string[]
          internacao_id: string | null
          neuro: Json
          paciente_id: string
          plantao: Database["public"]["Enums"]["plantao_enum"]
          prescricao: Json | null
          problemas_ativos: Json
          renal: Json
          resp: Json
          riscos: Json
          sedativos: Json
          sofa_snapshot: Json | null
          sofa_total: number | null
          tgi: Json
          tipo_nota: Database["public"]["Enums"]["tipo_nota_enum"]
          turno: Database["public"]["Enums"]["turno_enum"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          autor_crm?: string | null
          autor_nome?: string | null
          conduta?: string[]
          condutas_sistemas?: Json
          created_at?: string
          data_evolucao?: string
          data_plantao: string
          dvas?: Json
          finalizada_em?: string | null
          hemato?: Json
          hemo?: Json
          id?: string
          illness_severity?:
            | Database["public"]["Enums"]["gravidade_enum"]
            | null
          impressao?: string[]
          infecto?: Json
          intercorrencias?: string[]
          internacao_id?: string | null
          neuro?: Json
          paciente_id: string
          plantao?: Database["public"]["Enums"]["plantao_enum"]
          prescricao?: Json | null
          problemas_ativos?: Json
          renal?: Json
          resp?: Json
          riscos?: Json
          sedativos?: Json
          sofa_snapshot?: Json | null
          sofa_total?: number | null
          tgi?: Json
          tipo_nota?: Database["public"]["Enums"]["tipo_nota_enum"]
          turno: Database["public"]["Enums"]["turno_enum"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          autor_crm?: string | null
          autor_nome?: string | null
          conduta?: string[]
          condutas_sistemas?: Json
          created_at?: string
          data_evolucao?: string
          data_plantao?: string
          dvas?: Json
          finalizada_em?: string | null
          hemato?: Json
          hemo?: Json
          id?: string
          illness_severity?:
            | Database["public"]["Enums"]["gravidade_enum"]
            | null
          impressao?: string[]
          infecto?: Json
          intercorrencias?: string[]
          internacao_id?: string | null
          neuro?: Json
          paciente_id?: string
          plantao?: Database["public"]["Enums"]["plantao_enum"]
          prescricao?: Json | null
          problemas_ativos?: Json
          renal?: Json
          resp?: Json
          riscos?: Json
          sedativos?: Json
          sofa_snapshot?: Json | null
          sofa_total?: number | null
          tgi?: Json
          tipo_nota?: Database["public"]["Enums"]["tipo_nota_enum"]
          turno?: Database["public"]["Enums"]["turno_enum"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evolucoes_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
      ingest_audit_log: {
        Row: {
          created_at: string
          error_msg: string | null
          eventos_ids: string[] | null
          fonte: string | null
          id: string
          ok: boolean
          paciente_id: string | null
          payload_raw: Json | null
          response: Json | null
          source_type: string | null
          user_id: string | null
          warnings: string[] | null
        }
        Insert: {
          created_at?: string
          error_msg?: string | null
          eventos_ids?: string[] | null
          fonte?: string | null
          id?: string
          ok: boolean
          paciente_id?: string | null
          payload_raw?: Json | null
          response?: Json | null
          source_type?: string | null
          user_id?: string | null
          warnings?: string[] | null
        }
        Update: {
          created_at?: string
          error_msg?: string | null
          eventos_ids?: string[] | null
          fonte?: string | null
          id?: string
          ok?: boolean
          paciente_id?: string | null
          payload_raw?: Json | null
          response?: Json | null
          source_type?: string | null
          user_id?: string | null
          warnings?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "ingest_audit_log_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingest_audit_log_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
      internacoes: {
        Row: {
          created_at: string
          desfecho:
            | Database["public"]["Enums"]["desfecho_internacao_enum"]
            | null
          desfecho_data: string | null
          destino_especialidade: string | null
          destino_setor: string | null
          id: string
          int_origem_data: string | null
          int_uti_data: string
          internacao_prev_id: string | null
          observacoes: string | null
          paciente_id: string
          reinternacao: boolean
          updated_at: string
          user_id: string | null
          uti: Database["public"]["Enums"]["uti_enum"] | null
        }
        Insert: {
          created_at?: string
          desfecho?:
            | Database["public"]["Enums"]["desfecho_internacao_enum"]
            | null
          desfecho_data?: string | null
          destino_especialidade?: string | null
          destino_setor?: string | null
          id?: string
          int_origem_data?: string | null
          int_uti_data: string
          internacao_prev_id?: string | null
          observacoes?: string | null
          paciente_id: string
          reinternacao?: boolean
          updated_at?: string
          user_id?: string | null
          uti?: Database["public"]["Enums"]["uti_enum"] | null
        }
        Update: {
          created_at?: string
          desfecho?:
            | Database["public"]["Enums"]["desfecho_internacao_enum"]
            | null
          desfecho_data?: string | null
          destino_especialidade?: string | null
          destino_setor?: string | null
          id?: string
          int_origem_data?: string | null
          int_uti_data?: string
          internacao_prev_id?: string | null
          observacoes?: string | null
          paciente_id?: string
          reinternacao?: boolean
          updated_at?: string
          user_id?: string | null
          uti?: Database["public"]["Enums"]["uti_enum"] | null
        }
        Relationships: [
          {
            foreignKeyName: "internacoes_internacao_prev_id_fkey"
            columns: ["internacao_prev_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internacoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internacoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
      janelas_24h: {
        Row: {
          confidence: number | null
          created_at: string
          evolucao_id: string | null
          fonte: Database["public"]["Enums"]["fonte_evento_enum"]
          id: string
          internacao_id: string | null
          janela_fim: string
          janela_inicio: string
          limiar_alto: number | null
          limiar_baixo: number | null
          n_fora_alto: number | null
          n_fora_baixo: number | null
          n_total: number
          paciente_id: string
          requires_review: boolean
          source_text: string | null
          tipo: string
          user_id: string | null
          valor_max: number | null
          valor_min: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          evolucao_id?: string | null
          fonte?: Database["public"]["Enums"]["fonte_evento_enum"]
          id?: string
          internacao_id?: string | null
          janela_fim: string
          janela_inicio: string
          limiar_alto?: number | null
          limiar_baixo?: number | null
          n_fora_alto?: number | null
          n_fora_baixo?: number | null
          n_total?: number
          paciente_id: string
          requires_review?: boolean
          source_text?: string | null
          tipo: string
          user_id?: string | null
          valor_max?: number | null
          valor_min?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          evolucao_id?: string | null
          fonte?: Database["public"]["Enums"]["fonte_evento_enum"]
          id?: string
          internacao_id?: string | null
          janela_fim?: string
          janela_inicio?: string
          limiar_alto?: number | null
          limiar_baixo?: number | null
          n_fora_alto?: number | null
          n_fora_baixo?: number | null
          n_total?: number
          paciente_id?: string
          requires_review?: boolean
          source_text?: string | null
          tipo?: string
          user_id?: string | null
          valor_max?: number | null
          valor_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "janelas_24h_evolucao_id_fkey"
            columns: ["evolucao_id"]
            isOneToOne: false
            referencedRelation: "evolucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "janelas_24h_evolucao_id_fkey"
            columns: ["evolucao_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["evolucao_id"]
          },
          {
            foreignKeyName: "janelas_24h_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "janelas_24h_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "janelas_24h_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "janelas_24h_tipo_fkey"
            columns: ["tipo"]
            isOneToOne: false
            referencedRelation: "evento_tipo_ref"
            referencedColumns: ["codigo"]
          },
        ]
      }
      memorias: {
        Row: {
          conteudo: string
          created_at: string | null
          embedding: string | null
          id: number
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          conteudo: string
          created_at?: string | null
          embedding?: string | null
          id?: never
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          conteudo?: string
          created_at?: string | null
          embedding?: string | null
          id?: never
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      pacientes: {
        Row: {
          alergias: string | null
          altura: number | null
          created_at: string
          data_adm: string
          dispositivos: Json
          gravidade: Database["public"]["Enums"]["gravidade_enum"]
          hd: string | null
          id: string
          idade: number | null
          imc: number | null
          isolation: Database["public"]["Enums"]["isolamento_enum"]
          leito: string
          nome: string
          out_of_range_count: number
          patient_summary: Json | null
          peso: number | null
          riscos_flags: Json
          severidade_visual: Database["public"]["Enums"]["severidade_visual_enum"]
          sofa_baseline: number | null
          status_leito: Database["public"]["Enums"]["status_leito_enum"]
          updated_at: string
          user_id: string | null
          uti: Database["public"]["Enums"]["uti_enum"]
        }
        Insert: {
          alergias?: string | null
          altura?: number | null
          created_at?: string
          data_adm?: string
          dispositivos?: Json
          gravidade?: Database["public"]["Enums"]["gravidade_enum"]
          hd?: string | null
          id?: string
          idade?: number | null
          imc?: number | null
          isolation?: Database["public"]["Enums"]["isolamento_enum"]
          leito: string
          nome: string
          out_of_range_count?: number
          patient_summary?: Json | null
          peso?: number | null
          riscos_flags?: Json
          severidade_visual?: Database["public"]["Enums"]["severidade_visual_enum"]
          sofa_baseline?: number | null
          status_leito?: Database["public"]["Enums"]["status_leito_enum"]
          updated_at?: string
          user_id?: string | null
          uti: Database["public"]["Enums"]["uti_enum"]
        }
        Update: {
          alergias?: string | null
          altura?: number | null
          created_at?: string
          data_adm?: string
          dispositivos?: Json
          gravidade?: Database["public"]["Enums"]["gravidade_enum"]
          hd?: string | null
          id?: string
          idade?: number | null
          imc?: number | null
          isolation?: Database["public"]["Enums"]["isolamento_enum"]
          leito?: string
          nome?: string
          out_of_range_count?: number
          patient_summary?: Json | null
          peso?: number | null
          riscos_flags?: Json
          severidade_visual?: Database["public"]["Enums"]["severidade_visual_enum"]
          sofa_baseline?: number | null
          status_leito?: Database["public"]["Enums"]["status_leito_enum"]
          updated_at?: string
          user_id?: string | null
          uti?: Database["public"]["Enums"]["uti_enum"]
        }
        Relationships: []
      }
      pendencias: {
        Row: {
          concluida: boolean
          concluida_at: string | null
          created_at: string
          evolucao_id: string | null
          id: string
          internacao_id: string | null
          paciente_id: string
          prioridade: number
          tarefa: string
          user_id: string | null
        }
        Insert: {
          concluida?: boolean
          concluida_at?: string | null
          created_at?: string
          evolucao_id?: string | null
          id?: string
          internacao_id?: string | null
          paciente_id: string
          prioridade?: number
          tarefa: string
          user_id?: string | null
        }
        Update: {
          concluida?: boolean
          concluida_at?: string | null
          created_at?: string
          evolucao_id?: string | null
          id?: string
          internacao_id?: string | null
          paciente_id?: string
          prioridade?: number
          tarefa?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pendencias_evolucao_id_fkey"
            columns: ["evolucao_id"]
            isOneToOne: false
            referencedRelation: "evolucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_evolucao_id_fkey"
            columns: ["evolucao_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["evolucao_id"]
          },
          {
            foreignKeyName: "pendencias_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
      trend_rules: {
        Row: {
          ativo: boolean
          created_at: string
          fonte: string | null
          id: string
          janela_max_horas: number | null
          limiar: number
          mensagem: string
          modo: Database["public"]["Enums"]["trend_modo_enum"]
          ordem: number
          rotulo: string
          severidade: Database["public"]["Enums"]["severidade_alerta_enum"]
          tipo_evento: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          fonte?: string | null
          id?: string
          janela_max_horas?: number | null
          limiar: number
          mensagem: string
          modo: Database["public"]["Enums"]["trend_modo_enum"]
          ordem?: number
          rotulo: string
          severidade: Database["public"]["Enums"]["severidade_alerta_enum"]
          tipo_evento: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          fonte?: string | null
          id?: string
          janela_max_horas?: number | null
          limiar?: number
          mensagem?: string
          modo?: Database["public"]["Enums"]["trend_modo_enum"]
          ordem?: number
          rotulo?: string
          severidade?: Database["public"]["Enums"]["severidade_alerta_enum"]
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "trend_rules_tipo_fk"
            columns: ["tipo_evento"]
            isOneToOne: false
            referencedRelation: "evento_tipo_ref"
            referencedColumns: ["codigo"]
          },
        ]
      }
    }
    Views: {
      vw_alertas_abertos: {
        Row: {
          criticos: number | null
          infos: number | null
          leito: string | null
          nome: string | null
          paciente_id: string | null
          total: number | null
          uti: Database["public"]["Enums"]["uti_enum"] | null
          warnings: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_log_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_log_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
      vw_bh_acumulado: {
        Row: {
          bh_24h: number | null
          bh_48h: number | null
          bh_72h: number | null
          eventos_24h: number | null
          paciente_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
      vw_dashboard_uti: {
        Row: {
          data_adm: string | null
          delta_sofa_24h: number | null
          dias_internacao: number | null
          dispositivos: Json | null
          dvas: Json | null
          evolucao_id: string | null
          gravidade: Database["public"]["Enums"]["gravidade_enum"] | null
          hd: string | null
          idade: number | null
          isolation: Database["public"]["Enums"]["isolamento_enum"] | null
          leito: string | null
          nome: string | null
          out_of_range_count: number | null
          paciente_id: string | null
          pendencias_abertas: number | null
          peso: number | null
          sedativos: Json | null
          severidade_visual:
            | Database["public"]["Enums"]["severidade_visual_enum"]
            | null
          sofa_snapshot: Json | null
          sofa_total: number | null
          status_leito: Database["public"]["Enums"]["status_leito_enum"] | null
          ultima_evolucao: string | null
          user_id: string | null
          uti: Database["public"]["Enums"]["uti_enum"] | null
        }
        Relationships: []
      }
      vw_dias_atb_ativo: {
        Row: {
          agente_alvo: string | null
          atb_id: string | null
          data_inicio: string | null
          dias_terapia: number | null
          droga: string | null
          foco: string | null
          frequencia: string | null
          intencao: Database["public"]["Enums"]["intencao_atb_enum"] | null
          paciente_id: string | null
          stewardship_flag: string | null
          via: Database["public"]["Enums"]["via_atb_enum"] | null
        }
        Insert: {
          agente_alvo?: string | null
          atb_id?: string | null
          data_inicio?: string | null
          dias_terapia?: never
          droga?: string | null
          foco?: string | null
          frequencia?: string | null
          intencao?: Database["public"]["Enums"]["intencao_atb_enum"] | null
          paciente_id?: string | null
          stewardship_flag?: never
          via?: Database["public"]["Enums"]["via_atb_enum"] | null
        }
        Update: {
          agente_alvo?: string | null
          atb_id?: string | null
          data_inicio?: string | null
          dias_terapia?: never
          droga?: string | null
          foco?: string | null
          frequencia?: string | null
          intencao?: Database["public"]["Enums"]["intencao_atb_enum"] | null
          paciente_id?: string | null
          stewardship_flag?: never
          via?: Database["public"]["Enums"]["via_atb_enum"] | null
        }
        Relationships: [
          {
            foreignKeyName: "atbs_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atbs_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
      vw_dispositivos_ativos: {
        Row: {
          data_inicio: string | null
          dias_em_uso: number | null
          episodio_id: string | null
          internacao_id: string | null
          paciente_id: string | null
          sitio: string | null
          tipo: Database["public"]["Enums"]["dispositivo_tipo_enum"] | null
        }
        Insert: {
          data_inicio?: string | null
          dias_em_uso?: never
          episodio_id?: string | null
          internacao_id?: string | null
          paciente_id?: string | null
          sitio?: string | null
          tipo?: Database["public"]["Enums"]["dispositivo_tipo_enum"] | null
        }
        Update: {
          data_inicio?: string | null
          dias_em_uso?: never
          episodio_id?: string | null
          internacao_id?: string | null
          paciente_id?: string | null
          sitio?: string | null
          tipo?: Database["public"]["Enums"]["dispositivo_tipo_enum"] | null
        }
        Relationships: [
          {
            foreignKeyName: "dispositivo_episodios_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivo_episodios_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivo_episodios_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
      vw_eventos_pendentes_revisao: {
        Row: {
          confidence: number | null
          created_at: string | null
          evolucao_id: string | null
          fonte: Database["public"]["Enums"]["fonte_evento_enum"] | null
          id: string | null
          paciente_id: string | null
          requires_review: boolean | null
          source_text: string | null
          tipo: string | null
          ts: string | null
          unidade: string | null
          user_id: string | null
          valor_json: Json | null
          valor_num: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          evolucao_id?: string | null
          fonte?: Database["public"]["Enums"]["fonte_evento_enum"] | null
          id?: string | null
          paciente_id?: string | null
          requires_review?: boolean | null
          source_text?: string | null
          tipo?: string | null
          ts?: string | null
          unidade?: string | null
          user_id?: string | null
          valor_json?: Json | null
          valor_num?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          evolucao_id?: string | null
          fonte?: Database["public"]["Enums"]["fonte_evento_enum"] | null
          id?: string | null
          paciente_id?: string | null
          requires_review?: boolean | null
          source_text?: string | null
          tipo?: string | null
          ts?: string | null
          unidade?: string | null
          user_id?: string | null
          valor_json?: Json | null
          valor_num?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_clinicos_evolucao_id_fkey"
            columns: ["evolucao_id"]
            isOneToOne: false
            referencedRelation: "evolucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_clinicos_evolucao_id_fkey"
            columns: ["evolucao_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["evolucao_id"]
          },
          {
            foreignKeyName: "eventos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "eventos_tipo_fk"
            columns: ["tipo"]
            isOneToOne: false
            referencedRelation: "evento_tipo_ref"
            referencedColumns: ["codigo"]
          },
        ]
      }
      vw_eventos_tendencia: {
        Row: {
          delta: number | null
          gap_horas: number | null
          paciente_id: string | null
          tipo: string | null
          ts: string | null
          unidade: string | null
          valor_anterior: number | null
          valor_num: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "eventos_tipo_fk"
            columns: ["tipo"]
            isOneToOne: false
            referencedRelation: "evento_tipo_ref"
            referencedColumns: ["codigo"]
          },
        ]
      }
      vw_janelas_24h_render: {
        Row: {
          confidence: number | null
          created_at: string | null
          evolucao_id: string | null
          excursoes_txt: string | null
          faixa_txt: string | null
          fonte: Database["public"]["Enums"]["fonte_evento_enum"] | null
          id: string | null
          internacao_id: string | null
          janela_fim: string | null
          janela_inicio: string | null
          limiar_alto: number | null
          limiar_baixo: number | null
          n_fora_alto: number | null
          n_fora_baixo: number | null
          n_total: number | null
          paciente_id: string | null
          render: string | null
          requires_review: boolean | null
          rotulo: string | null
          source_text: string | null
          tipo: string | null
          unidade_padrao: string | null
          user_id: string | null
          valor_max: number | null
          valor_min: number | null
        }
        Relationships: [
          {
            foreignKeyName: "janelas_24h_evolucao_id_fkey"
            columns: ["evolucao_id"]
            isOneToOne: false
            referencedRelation: "evolucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "janelas_24h_evolucao_id_fkey"
            columns: ["evolucao_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["evolucao_id"]
          },
          {
            foreignKeyName: "janelas_24h_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "janelas_24h_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "janelas_24h_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "janelas_24h_tipo_fkey"
            columns: ["tipo"]
            isOneToOne: false
            referencedRelation: "evento_tipo_ref"
            referencedColumns: ["codigo"]
          },
        ]
      }
      vw_sofa_diario: {
        Row: {
          componentes_faltantes: string[] | null
          componentes_presentes: number | null
          dia: string | null
          paciente_id: string | null
          s_cardio: number | null
          s_coag: number | null
          s_liver: number | null
          s_neuro: number | null
          s_renal: number | null
          s_resp: number | null
          sofa_parcial: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
      vw_sofa_trend_72h: {
        Row: {
          paciente_id: string | null
          sofa_total: number | null
          ts: string | null
        }
        Insert: {
          paciente_id?: string | null
          sofa_total?: number | null
          ts?: string | null
        }
        Update: {
          paciente_id?: string | null
          sofa_total?: number | null
          ts?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_uti"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
    }
    Functions: {
      fmt_num: { Args: { n: number }; Returns: string }
      fn_alert_hash: {
        Args: { p_paciente_id: string; p_payload: Json; p_tipo: string }
        Returns: string
      }
      fn_internacao_atual: { Args: { p_paciente: string }; Returns: string }
      fn_refresh_dispositivos: {
        Args: { p_paciente: string }
        Returns: undefined
      }
      match_memorias: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          conteudo: string
          id: number
          similarity: number
        }[]
      }
      save_ficha: {
        Args: {
          p_evol: Json
          p_evolucao_id: string
          p_pac: Json
          p_paciente_id: string
          p_pendencias?: Json
          p_plantao: string
        }
        Returns: string
      }
    }
    Enums: {
      antibiograma_resultado_enum: "S" | "I" | "R"
      comparador_enum: "lt" | "lte" | "gt" | "gte"
      desfecho_internacao_enum:
        | "alta_uti"
        | "alta_hospitalar"
        | "obito"
        | "transferencia"
      dispositivo_motivo_fim_enum:
        | "eletivo"
        | "infeccao"
        | "troca"
        | "disfuncao"
        | "alta"
        | "obito"
        | "outro"
      dispositivo_tipo_enum:
        | "iot"
        | "traqueo"
        | "cvc"
        | "picc"
        | "arterial"
        | "svd"
        | "sne"
        | "sng"
        | "dreno"
        | "gtt"
        | "trr"
        | "marca_passo"
        | "outro"
      fonte_evento_enum:
        | "manual"
        | "gemini_ocr"
        | "claude_ocr"
        | "appsheet"
        | "auto_trigger"
        | "edge_function"
        | "api_import"
      gravidade_enum: "estavel" | "watcher" | "instavel" | "critico"
      intencao_atb_enum: "empirica" | "dirigida" | "profilatica"
      isolamento_enum: "none" | "contact" | "droplet" | "aerosol"
      material_cultura_enum:
        | "hemocultura"
        | "urocultura"
        | "aspirado_traqueal"
        | "lavado_bal"
        | "lcr"
        | "secrecao_ferida"
        | "liquido_peritoneal"
        | "liquido_pleural"
        | "outro"
      plantao_enum: "manha" | "tarde" | "noite" | "plantao_24h"
      severidade_alerta_enum: "info" | "warning" | "critical"
      severidade_visual_enum: "red" | "yellow" | "green"
      status_leito_enum: "ativo" | "alta" | "obito" | "transferencia"
      tipo_nota_enum: "admissao" | "seriada" | "alta" | "andar"
      trend_modo_enum: "subida_abs" | "subida_rel" | "queda_abs"
      turno_enum: "diurna" | "noturna"
      uti_enum: "UTI2" | "UTI3" | "UTI4"
      via_atb_enum: "EV" | "VO" | "IM" | "SC" | "SNE" | "SNG" | "IT" | "Tópico"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      antibiograma_resultado_enum: ["S", "I", "R"],
      comparador_enum: ["lt", "lte", "gt", "gte"],
      desfecho_internacao_enum: [
        "alta_uti",
        "alta_hospitalar",
        "obito",
        "transferencia",
      ],
      dispositivo_motivo_fim_enum: [
        "eletivo",
        "infeccao",
        "troca",
        "disfuncao",
        "alta",
        "obito",
        "outro",
      ],
      dispositivo_tipo_enum: [
        "iot",
        "traqueo",
        "cvc",
        "picc",
        "arterial",
        "svd",
        "sne",
        "sng",
        "dreno",
        "gtt",
        "trr",
        "marca_passo",
        "outro",
      ],
      fonte_evento_enum: [
        "manual",
        "gemini_ocr",
        "claude_ocr",
        "appsheet",
        "auto_trigger",
        "edge_function",
        "api_import",
      ],
      gravidade_enum: ["estavel", "watcher", "instavel", "critico"],
      intencao_atb_enum: ["empirica", "dirigida", "profilatica"],
      isolamento_enum: ["none", "contact", "droplet", "aerosol"],
      material_cultura_enum: [
        "hemocultura",
        "urocultura",
        "aspirado_traqueal",
        "lavado_bal",
        "lcr",
        "secrecao_ferida",
        "liquido_peritoneal",
        "liquido_pleural",
        "outro",
      ],
      plantao_enum: ["manha", "tarde", "noite", "plantao_24h"],
      severidade_alerta_enum: ["info", "warning", "critical"],
      severidade_visual_enum: ["red", "yellow", "green"],
      status_leito_enum: ["ativo", "alta", "obito", "transferencia"],
      tipo_nota_enum: ["admissao", "seriada", "alta", "andar"],
      trend_modo_enum: ["subida_abs", "subida_rel", "queda_abs"],
      turno_enum: ["diurna", "noturna"],
      uti_enum: ["UTI2", "UTI3", "UTI4"],
      via_atb_enum: ["EV", "VO", "IM", "SC", "SNE", "SNG", "IT", "Tópico"],
    },
  },
} as const
