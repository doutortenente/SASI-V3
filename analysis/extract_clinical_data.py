#!/usr/bin/env python3
"""
Extrai dados clínicos do Supabase para análise.
Requisitos: pandas, supabase, python-dotenv
Instale com: pip install pandas supabase python-dotenv
"""

import os
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv(dotenv_path="../.env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Variáveis SUPABASE_URL ou SUPABASE_KEY não encontradas em ../.env.local")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def extract_vitals():
    """Extrai sinais vitais (FC, PA, SpO2, temperatura)."""
    print("🔄 Extraindo sinais vitais...")
    response = supabase.table("vitals").select("*").execute()
    df = pd.DataFrame(response.data)
    if df.empty:
        print("⚠️ Nenhum dado de sinais vitais encontrado.")
        return None
    df.to_csv("vitals.csv", index=False)
    print(f"✅ Sinais vitais salvos em vitals.csv ({len(df)} registros)")
    return df


def extract_labs():
    """Extrai exames laboratoriais (lactato, gasometria, hemograma)."""
    print("🔄 Extraindo exames laboratoriais...")
    response = supabase.table("labs").select("*").execute()
    df = pd.DataFrame(response.data)
    if df.empty:
        print("⚠️ Nenhum exame laboratorial encontrado.")
        return None
    df.to_csv("labs.csv", index=False)
    print(f"✅ Exames salvos em labs.csv ({len(df)} registros)")
    return df


def extract_prescriptions():
    """Extrai prescrições (drogas vasoativas, antibióticos)."""
    print("🔄 Extraindo prescrições...")
    response = supabase.table("prescriptions").select("*").execute()
    df = pd.DataFrame(response.data)
    if df.empty:
        print("⚠️ Nenhuma prescrição encontrada.")
        return None
    df.to_csv("prescriptions.csv", index=False)
    print(f"✅ Prescrições salvas em prescriptions.csv ({len(df)} registros)")
    return df


if __name__ == "__main__":
    # Criar diretório se não existir
    os.makedirs("data", exist_ok=True)
    os.chdir("data")
    
    # Extrair dados
    vitals = extract_vitals()
    labs = extract_labs()
    prescriptions = extract_prescriptions()
    
    print("\n📊 Dados extraídos com sucesso!")
    print(f"Sinais vitais: {'✅' if vitals is not None else '❌'}")
    print(f"Exames: {'✅' if labs is not None else '❌'}")
    print(f"Prescrições: {'✅' if prescriptions is not None else '❌'}")