import streamlit as st
from streamlit_option_menu import option_menu
from database.connection import init_db
from database.crud import listar_profs_reforco, listar_profs_regentes, contar_notificacoes_reforco, contar_notificacoes_regente
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
    # CSS responsivo para ajustar tamanhos no mobile vs desktop
    resp_css = """
    <style>
    .title-main { text-align: center; color: #2C3E50; font-size: 2.5rem; font-weight: bold; margin-top: 20px; }
    .subtitle-main { text-align: center; color: #7F8C8D; font-size: 1.2rem; margin-bottom: 30px; }
    .emoji-icon { text-align: center; font-size: 3rem; margin-bottom: 10px; line-height: 1; }
    
    @media (max-width: 768px) {
        .title-main { font-size: 1.6rem !important; margin-top: 5px !important; }
        .subtitle-main { font-size: 1rem !important; margin-bottom: 15px !important; }
        .emoji-icon { font-size: 2rem !important; margin-bottom: 5px !important; }
        /* Reduz padding das bordas do container padrão no web no mobile */
        [data-testid="stVerticalBlockBorderWrapper"] { padding: 0.5rem !important; }
    }
    </style>
    <div class="title-main">Portal Educacional de Reforço</div>
    <div class="subtitle-main">Selecione o seu perfil de acesso</div>
    """
    st.markdown(resp_css, unsafe_allow_html=True)
    
    c1, c2, c3 = st.columns(3)
    
    with c1:
        with st.container(border=True):
            st.markdown("<div class='emoji-icon'>👨‍🏫</div>", unsafe_allow_html=True)
            if st.button("Prof. de Reforço", use_container_width=True, type="primary"):
                st.session_state.modo_login = "login_reforco"
                if "pedir_senha_coord" in st.session_state: st.session_state.pedir_senha_coord = False
    with c2:
        with st.container(border=True):
            st.markdown("<div class='emoji-icon'>👩‍🏫</div>", unsafe_allow_html=True)
            if st.button("Prof. Regente", use_container_width=True, type="primary"):
                st.session_state.modo_login = "login_regente"
                if "pedir_senha_coord" in st.session_state: st.session_state.pedir_senha_coord = False
    with c3:
        with st.container(border=True):
            st.markdown("<div class='emoji-icon'>📋</div>", unsafe_allow_html=True)
            if st.button("Coordenação", use_container_width=True):
                st.session_state.pedir_senha_coord = True
                st.session_state.modo_login = None

    if st.session_state.get("pedir_senha_coord", False):
        st.markdown("<br>", unsafe_allow_html=True)
        _, pw_col, _ = st.columns([1, 6, 1])
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
        st.markdown("<br>", unsafe_allow_html=True)
        _, col_login, _ = st.columns([1, 6, 1])
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
        
        # === Contagem de Notificações ===
        notif_count = 0
        if st.session_state.perfil == "reforco" and st.session_state.prof_id:
            notif_count = contar_notificacoes_reforco(st.session_state.prof_id)
        elif st.session_state.perfil == "regente" and st.session_state.prof_id:
            notif_count = contar_notificacoes_regente(st.session_state.prof_id)
        
        if st.session_state.perfil == "reforco":
            st.caption(f"Reforço: **{st.session_state.prof_nome}**")
            if notif_count > 0:
                st.markdown(f"🔔 **{notif_count} pedido{'s' if notif_count > 1 else ''} de regente{'s' if notif_count > 1 else ''} pendente{'s' if notif_count > 1 else ''}**")
            label_diario = f"Registro Diário ({notif_count})" if notif_count > 0 else "Registro Diário"
            options = ["Dashboard", label_diario, "Registro Mensal", "Histórico de Registros"]
            icons = ["bar-chart", "journal-text", "calendar-check", "clock-history"]
            
        elif st.session_state.perfil == "regente":
            st.caption(f"Regente: **{st.session_state.prof_nome}**")
            if notif_count > 0:
                st.markdown(f"🔔 **{notif_count} resposta{'s' if notif_count > 1 else ''} do reforço não lida{'s' if notif_count > 1 else ''}**")
            label_painel = f"Painel da Turma ({notif_count})" if notif_count > 0 else "Painel da Turma"
            options = [label_painel, "Relatório de Evolução"]
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
    elif selected.startswith("Registro Diário"):
        from views.registro_diario import render
        render()

    elif selected == "Registro Mensal":
        from views.consolidado import render
        render()
        
    elif selected == "Histórico de Registros":
        from views.historico import render
        render()
        
    # Roteamento Regente
    elif selected.startswith("Painel da Turma"):
        from views.painel_regente import render
        render()

    elif selected == "Relatório de Evolução":
        from views.relatorio_evolucao_regente import render
        render()

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
