import firebase_admin
from firebase_admin import credentials, firestore
import os

import streamlit as st

def init_db():
    try:
        firebase_admin.get_app()
    except ValueError:
        # Prioritize local development file
        if os.path.exists('serviceAccountKey.json'):
            cred = credentials.Certificate('serviceAccountKey.json')
        else:
            # Fallback to Streamlit Secrets (Cloud)
            try:
                if "firebase_json" in st.secrets:
                    import json
                    fb_creds = json.loads(st.secrets["firebase_json"], strict=False)
                    cred = credentials.Certificate(fb_creds)
                elif "firebase" in st.secrets:
                    fb_creds = {k: v for k, v in st.secrets["firebase"].items()}
                    if "private_key" in fb_creds:
                        raw_key = fb_creds["private_key"].strip().strip('"')
                        fb_creds["private_key"] = raw_key.replace("\\n", "\n") if "\\n" in raw_key else raw_key
                    cred = credentials.Certificate(fb_creds)
                else:
                    st.error("Arquivo 'serviceAccountKey.json' não encontrado e Segredos não configurados.")
                    st.stop()
            except Exception:
                st.error("Erro ao acessar st.secrets. Certifique-se de que o arquivo .streamlit/secrets.toml existe ou que os segredos estão configurados na nuvem.")
                st.stop()
            
        firebase_admin.initialize_app(cred)
        print("✅ Firebase initialized successfully!")

def get_db():
    init_db()
    return firestore.client()
