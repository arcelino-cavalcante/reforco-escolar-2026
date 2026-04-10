import streamlit as st
from streamlit_option_menu import option_menu
from database.connection import init_db
from database.crud import listar_profs_reforco, listar_profs_regentes
from utils.styles import aplicar_estilos

# ===== CONFIGURAÇÃO DA PÁGINA =====
st.set_page_config(
    page_title="Reforço Escolar",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="auto"
)

# ===== INICIALIZAR BANCO DE DADOS =====
init_db()

# ===== APLICAR ESTILOS =====
aplicar_estilos()

# ===== INICIALIZAÇÃO DE SESSÃO =====
if 'perfil' not in st.session_state:
    st.session_state.perfil = None
if 'modo_login' not in st.session_state:
    st.session_state.modo_login = None
if 'prof_id' not in st.session_state:
    st.session_state.prof_id = None
if 'prof_nome' not in st.session_state:
    st.session_state.prof_nome = None

# ===== TELA DE LOGIN =====
if st.session_state.perfil is None:
    st.markdown("<br><br>", unsafe_allow_html=True)
    st.markdown("<h1 style='text-align: center; color: #2C3E50;'>Portal Educacional de Reforço</h1>", unsafe_allow_html=True)
    st.markdown("<h4 style='text-align: center; color: #7F8C8D; margin-bottom: 40px;'>Selecione o seu perfil de acesso</h4>", unsafe_allow_html=True)
    
    _, center_col, _ = st.columns([1, 4, 1])
    
    with center_col:
        c1, c2, c3 = st.columns(3)
        with c1:
            with st.container(border=True):
                st.markdown("<div style='text-align: center; font-size: 3.5rem; margin-bottom:10px;'>👨‍🏫</div>", unsafe_allow_html=True)
                if st.button("Prof. de Reforço", use_container_width=True, type="primary"):
                    st.session_state.modo_login = "login_reforco"
                    if "pedir_senha_coord" in st.session_state: st.session_state.pedir_senha_coord = False
        with c2:
            with st.container(border=True):
                st.markdown("<div style='text-align: center; font-size: 3.5rem; margin-bottom:10px;'>👩‍🏫</div>", unsafe_allow_html=True)
                if st.button("Prof. Regente", use_container_width=True, type="primary"):
                    st.session_state.modo_login = "login_regente"
                    if "pedir_senha_coord" in st.session_state: st.session_state.pedir_senha_coord = False
        with c3:
            with st.container(border=True):
                st.markdown("<div style='text-align: center; font-size: 3.5rem; margin-bottom:10px;'>📋</div>", unsafe_allow_html=True)
                if st.button("Coordenação", use_container_width=True):
                    st.session_state.pedir_senha_coord = True
                    st.session_state.modo_login = None

    st.markdown("<br>", unsafe_allow_html=True)
    
    # Campo de Senha para Coordenação
    if st.session_state.get("pedir_senha_coord", False):
        _, pw_col, _ = st.columns([2, 3, 2])
        with pw_col:
            with st.form("form_coord"):
                st.info("🔐 Área restrita à Coordenação Pedagógica")
                senha = st.text_input("Digite a senha de acesso:", type="password")
                submit = st.form_submit_button("Entrar", type="primary", use_container_width=True)
                
                if submit:
                    try:
                        senha_correta = st.secrets.get("coordenacao", {}).get("senha", "123456")
                    except Exception:
                        senha_correta = "123456"
                    if senha == senha_correta:
                        st.session_state.perfil = "coordenacao"
                        st.session_state.pedir_senha_coord = False
                        st.rerun()
                    else:
                        st.error("Senha incorreta!")
    
    # Exibir dropdowns de login se selecionou um modo de professor
    elif st.session_state.modo_login in ["login_reforco", "login_regente"]:
        _, col_login, _ = st.columns([2, 3, 2])
        with col_login:
            with st.container(border=True):
                if st.session_state.modo_login == "login_reforco":
                    st.markdown("#### 🔓 Acesso: Reforço Escolar")
                    profs = listar_profs_reforco()
                    if not profs:
                        st.warning("Nenhum professor de reforço cadastrado pela Coordenação.")
                    else:
                        opcoes = {p['nome']: p['id'] for p in profs}
                        nome_sel = st.selectbox("Selecione sua identificação:", list(opcoes.keys()))
                        if st.button("Entrar no Sistema", type="primary", use_container_width=True):
                            st.session_state.perfil = "reforco"
                            st.session_state.prof_id = opcoes[nome_sel]
                            st.session_state.prof_nome = nome_sel
                            st.session_state.modo_login = None
                            st.rerun()

                elif st.session_state.modo_login == "login_regente":
                    st.markdown("#### 🔓 Acesso: Prof. Regente")
                    profs = listar_profs_regentes()
                    if not profs:
                        st.warning("Nenhum professor regente cadastrado.")
                    else:
                        opcoes = {p['nome']: p['id'] for p in profs}
                        nome_sel = st.selectbox("Selecione sua identificação:", list(opcoes.keys()))
                        if st.button("Entrar no Sistema", type="primary", use_container_width=True):
                            st.session_state.perfil = "regente"
                            st.session_state.prof_id = opcoes[nome_sel]
                            st.session_state.prof_nome = nome_sel
                            st.session_state.modo_login = None
                            st.rerun()

# ===== MENUS DO SISTEMA (PÓS-LOGIN) =====
else:
    with st.sidebar:
        st.title("📚 Reforço Escolar")
        
        if st.session_state.perfil == "reforco":
            st.caption(f"Reforço: **{st.session_state.prof_nome}**")
            options = ["Dashboard", "Registro Diário", "Registro Mensal", "Histórico de Registros"]
            icons = ["bar-chart", "journal-text", "calendar-check", "clock-history"]
            
        elif st.session_state.perfil == "regente":
            st.caption(f"Regente: **{st.session_state.prof_nome}**")
            options = ["Painel da Turma", "Relatório de Evolução"]
            icons = ["people", "graph-up"]
            
        else:
            st.caption("Perfil: **Coordenação**")
            options = ["Dashboard", "Análise de Evolução", "Dossiê do Estudante", "Ver Registros", "Assistente de IA", "Cérebro da IA", "Cadastrar Turmas", 
                       "Cadastrar Estudantes", "Cadastrar Professores"]
            icons = ["bar-chart", "graph-up-arrow", "person-badge", "table", "robot", "cpu", "layers", "people", "person-workspace"]

        st.divider()

        selected = option_menu(
            menu_title=None,
            options=options,
            icons=icons,
            default_index=0
        )

        st.divider()
        if st.button("🚪 Sair / Trocar Perfil", use_container_width=True):
            st.session_state.perfil = None
            st.session_state.prof_id = None
            st.session_state.prof_nome = None
            st.session_state.modo_login = None
            st.rerun()

    # ===== ROTEAMENTO DE PÁGINAS =====
    if selected == "Dashboard":
        from views.dashboard import render
        render()
    
    # Roteamento Reforço
    elif selected == "Registro Diário":
        from views.registro_diario import render
        render()

    elif selected == "Registro Mensal":
        from views.consolidado import render
        render()
        
    elif selected == "Histórico de Registros":
        from views.historico import render
        render()
        
    # Roteamento Regente
    elif selected == "Painel da Turma":
        from views.painel_regente import render
        render()

    elif selected == "Relatório de Evolução":
        st.header("Relatório de Evolução")
        st.info("Visão de gráficos ainda em construção para o Prof. Regente.")

    elif selected == "Ver Registros":
        from views.ver_registros import render
        render()
        
    elif selected == "Assistente de IA":
        from views.assistente_ia import render
        render()

    elif selected == "Cérebro da IA":
        from views.cerebro_ia import render
        render()
        
    elif selected == "Análise de Evolução":
        from views.analise_evolucao import render
        render()
    elif selected == "Dossiê do Estudante":
        from views.perfil_estudante import render
        render()

    elif selected in ["Cadastrar Turmas", "Cadastrar Estudantes", "Cadastrar Professores"]:
        from views.cadastros import render
        render(selected)
