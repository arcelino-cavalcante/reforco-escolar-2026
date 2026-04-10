import streamlit as st
import json
from openai import OpenAI
from database.crud import listar_estudantes, listar_todos_registros_diarios_ultimos_dias, obter_contexto_ia
from utils.styles import page_header

def build_data_context_text():
    estudantes = listar_estudantes()
    # OTIMIZAÇÃO: Filtrando penas os ultimos 30 dias de registros para não estourar a cota Token
    diarios = listar_todos_registros_diarios_ultimos_dias(30)
    
    # OTIMIZAÇÃO: Exportando os arrays JSON para CSV para economia superior a 60% do peso do prompt
    est_lines = ["ALUNOS: Nome, Turma, Etapa"]
    for e in estudantes: 
        est_lines.append(f"{e['nome']},{e['turma_nome']},{e['etapa_nome']}")
    estudantes_csv = "\n".join(est_lines)
    
    dia_lines = ["\nREGISTROS (Últimos 30 dias): Data,Aluno,Prof,Area,Presenca,Habilidade_Falta,Compreensao,Atividade,Emocional"]
    for r in diarios:
        hab_falta = r['habilidade_trabalhada'] if r['compareceu'] == 1 else (r['motivo_falta'] or 'Falta')
        comp = r.get('nivel_compreensao', 0) if r['compareceu'] == 1 else "-"
        ativ = r.get('tipo_atividade') or "-"
        emoc = r.get('estado_emocional') or "-"
        # Removido espaços excessivos propositalmente
        dia_lines.append(f"{r['data_registro']},{r['estudante_nome']},{r['prof_nome']},{r['prof_area']},{'Sim' if r['compareceu']==1 else 'Nao'},{hab_falta},{comp},{ativ},{emoc}")
    diarios_csv = "\n".join(dia_lines)
    
    return estudantes_csv + "\n" + diarios_csv

def build_system_prompt():
    """
    Constrói a string de contexto contendo o "banco de dados" em formato hiper comprimido CSV.
    Isso fornece à IA o contexto real de alunos e registros limitados e limpos.
    """
    regras_escola = obter_contexto_ia()
    data_text = build_data_context_text()
    
    prompt = (
        "Você é o Assistente de IA Pedagógico do sistema de Reforço Escolar.\n"
        "Abaixo estão os dados dos estudantes e dos registros diários (dos últimos 30 dias) em formato CSV delimitado por vírgula.\n"
        "Sua função é atuar como analista de dados educacionais, respondendo com clareza, objetividade e cordialidade "
        "às perguntas da Coordenação sobre a evolução dos alunos, frequência (faltas) e habilidades.\n"
        f"DIRETRIZES PERSONALIZADAS DA ESCOLA:\n{regras_escola}\n\n"
        f"DADOS DO SISTEMA:\n{data_text}\n"
    )
    return prompt

def render():
    page_header("🤖 Assistente de IA", "Converse com os dados do sistema usando a OpenAI.")

    # 1. Obter a chave (Prioridade: Secrets do Streamlit Cloud)
    api_key_input = ""
    try:
        if "openai" in st.secrets:
            api_key_input = st.secrets["openai"].get("api_key", "")
    except Exception:
        pass  # Sem secrets.toml — modo local
    
    if not api_key_input:
        # Tenta campo manual apenas se não houver segredo
        api_key_input = st.text_input("Chave OpenAI não configurada. Digite aqui:", type="password")
        if not api_key_input:
            st.info("Configure a chave da API no painel de Segredos do Streamlit para omitir este campo.")
            return

    import httpx
    # Inicializar Cliente OpenAI
    try:
        # Usa um cliente nativo para contornar problemas de cache de rede do Streamlit
        client = OpenAI(
            api_key=api_key_input,
            http_client=httpx.Client(timeout=60.0)
        )
    except Exception as e:
        st.error(f"Erro na configuração da API: {e}")
        return

    # 2. Configurar o estado do Chat (Memória)
    if "messages" not in st.session_state:
        st.session_state.messages = []
        
    # InjectSystem Prompt se for o inicio real da interacao subjacente (poupando historico)
    if "system_prompt_loaded" not in st.session_state:
        st.session_state.system_prompt_loaded = True

    # Botão para limpar contexto
    if st.button("🧹 Limpar Histórico de Conversa"):
        st.session_state.messages = []
        st.rerun()

    st.write("---")

    # Exibir a conversa historica
    for msg in st.session_state.messages:
        if msg["role"] != "system": # não exibir o enorme system prompt na tela
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])

    # Sugestões de Perguntas
    st.write("💡 **Perguntas Sugeridas:**")
    c1, c2, c3 = st.columns(3)
    sug_1 = c1.button("Quais habilidades mais trabalhadas?", use_container_width=True)
    sug_2 = c2.button("Resumo de Faltas (Alunos e Motivos)", use_container_width=True)
    sug_3 = c3.button("Alunos Próximos de ter Alta", use_container_width=True)
    
    prompt = st.chat_input("O que você deseja analisar sobre os alunos?")
    
    if sug_1: prompt = "Liste as habilidades mais trabalhadas e cite os gargalos comuns encontrados."
    if sug_2: prompt = "Quem são os alunos com mais faltas e quais seus principais motivos?"
    if sug_3: prompt = "Quais alunos alcançaram dominío (autônomo) frequentemente e podem ter alta em breve?"

    # 3. Tratar a Entrada do Usuário
    if prompt:
        # Adicionar mensagem na tela/historico user
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # Preparar Mensagens API (Sempre incluindo System Context para ground truth atualizado)
        # O system_prompt é recalculado caso o banco tenha mudado no decorrer da sessão
        api_messages = [{"role": "system", "content": build_system_prompt()}]
        
        # Filtra histórico de usuario tirando possiveis mensagens de system antigas, e anexa à requisicao
        historico_user_ai = [m for m in st.session_state.messages if m["role"] != "system"]
        api_messages.extend(historico_user_ai)

        with st.chat_message("assistant"):
            message_placeholder = st.empty()
            full_response = ""
            
            with st.spinner("Analisando dados do reforço..."):
                try:
                    # Request Streaming Standard
                    stream = client.chat.completions.create(
                        model="gpt-4o-mini", # Modelo atualizado e rapido
                        messages=api_messages,
                        stream=True,
                    )
                    
                    for chunk in stream:
                        if chunk.choices[0].delta.content is not None:
                            full_response += chunk.choices[0].delta.content
                            message_placeholder.markdown(full_response + "▌")
                    
                    message_placeholder.markdown(full_response)
                except Exception as ex:
                    st.error(f"Ocorreu um erro na API: {ex}")
                    return
        
        # Append historico final assistant
        st.session_state.messages.append({"role": "assistant", "content": full_response})
