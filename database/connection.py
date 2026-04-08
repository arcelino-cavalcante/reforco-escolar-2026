import firebase_admin
from firebase_admin import credentials, firestore

import streamlit as st

def init_db():
    try:
        firebase_admin.get_app()
    except ValueError:
        # Tenta carregar dos Secrets do Streamlit (Nuvem) ou Arquivo Local
        if "firebase" in st.secrets:
            # Reconstrói o dicionário de forma explícita para evitar erros de tipo do AttrDict
            fb_creds = {k: v for k, v in st.secrets["firebase"].items()}
            
            # Limpeza cirúrgica da chave privada (o ponto mais comum de erro no Streamlit Cloud)
            if "private_key" in fb_creds:
                # Remove possíveis aspas extras e garante conversão correta de \n
                raw_key = fb_creds["private_key"].strip().strip('"')
                if "\\n" in raw_key:
                    fb_creds["private_key"] = raw_key.replace("\\n", "\n")
                else:
                    fb_creds["private_key"] = raw_key
                    
            cred = credentials.Certificate(fb_creds)
        else:
            # Fallback para desenvolvimento local
            cred = credentials.Certificate('serviceAccountKey.json')
            
        firebase_admin.initialize_app(cred)
        print("✅ Firebase initialized successfully!")

def get_db():
    init_db()
    return firestore.client()
