import streamlit as st
import pandas as pd
from database.crud import (
    listar_etapas, 
    criar_turma, listar_turmas, excluir_turma,
    criar_estudante, listar_estudantes, excluir_estudante,
    criar_prof_reforco, listar_profs_reforco, excluir_prof_reforco,
    criar_prof_regente, listar_profs_regentes, excluir_prof_regente
)
from utils.styles import page_header

def render(aba_selecionada):
    if aba_selecionada == "Cadastrar Turmas":
        _render_turmas()
    elif aba_selecionada == "Cadastrar Estudantes":
        _render_estudantes()
    elif aba_selecionada == "Cadastrar Professores":
        _render_professores()

# ==============================
# TURMAS
# ==============================
from database.crud import atualizar_turma

def _render_turmas():
    page_header("🏫 Cadastrar Turmas", "Gerencie as turmas ativas na escola.")
    etapas = listar_etapas()
    
    st.subheader("Nova Turma", divider="gray")
    with st.form("form_nova_turma", clear_on_submit=True):
        col_in1, col_in2 = st.columns(2)
        with col_in1:
            nome_turma = st.text_input("Nome da Turma *", placeholder="Ex: 5º Ano A")
        with col_in2:
            opcoes_etapa = {e['nome']: e['id'] for e in etapas}
            etapa_selecionada = st.selectbox("Selecione a Etapa", list(opcoes_etapa.keys()))
        
        if st.form_submit_button("Cadastrar", type="primary"):
            if not nome_turma.strip():
                st.error("O nome da turma é obrigatório.")
            else:
                criar_turma(nome_turma.strip(), opcoes_etapa[etapa_selecionada])
                st.success(f"Turma '{nome_turma}' cadastrada!")
                st.rerun()

    st.write("<br>", unsafe_allow_html=True)
    st.subheader("Turmas Cadastradas", divider="gray")
    
    turmas = listar_turmas()
    if not turmas:
        st.info("Nenhuma turma cadastrada no momento.")
        return

    # Inicializar estado para exibir modal/formulario inline de edicao
    if 'editando_turma' not in st.session_state:
        st.session_state.editando_turma = None

    for t in turmas:
        with st.container(border=True):
            col_info, col_btn_edit, col_btn_del = st.columns([6, 1, 1])
            col_info.write(f"**{t['nome']}** — *(Etapa: {t['etapa_nome']})*")
            
            if col_btn_edit.button("✏️ Editar", key=f"btn_edit_t_{t['id']}", use_container_width=True):
                st.session_state.editando_turma = t['id']
                st.rerun()
                
            if col_btn_del.button("🗑️ Apagar", key=f"btn_del_t_{t['id']}", use_container_width=True):
                excluir_turma(t['id'])
                st.rerun()

            # Renderizar Form Inline caso este seja o item sendo editado
            if st.session_state.editando_turma == t['id']:
                st.divider()
                with st.form(f"form_update_turma_{t['id']}"):
                    st.write(f"**Atualizando dados de:** {t['nome']}")
                    
                    novo_nome_t = st.text_input("Novo nome:", value=t['nome'])
                    
                    # Obter índice atual da etapa para selecionar como default
                    opcoes_etapa = {e['nome']: e['id'] for e in etapas}
                    etapa_atual = t['etapa_nome']
                    etapa_idx = list(opcoes_etapa.keys()).index(etapa_atual) if etapa_atual in opcoes_etapa else 0
                    nova_etapa_nome = st.selectbox("Alterar Etapa", list(opcoes_etapa.keys()), index=etapa_idx, key=f"sel_etapa_{t['id']}")
                    
                    col_sv, col_cx = st.columns(2)
                    if col_sv.form_submit_button("✅ Salvar Alterações", use_container_width=True):
                        if not novo_nome_t.strip():
                            st.error("O nome da turma não pode ficar vazio.")
                        else:
                            atualizar_turma(t['id'], novo_nome_t.strip(), opcoes_etapa[nova_etapa_nome])
                            st.session_state.editando_turma = None
                            st.rerun()
                            
                    if col_cx.form_submit_button("❌ Cancelar", use_container_width=True):
                        st.session_state.editando_turma = None
                        st.rerun()

# ==============================
# ESTUDANTES
# ==============================
def _render_estudantes():
    page_header("🎓 Cadastrar Estudantes", "Gerencie os alunos participantes do reforço escolar.")
    turmas = listar_turmas()
    
    st.subheader("Novo Estudante", divider="gray")
    if not turmas:
        st.warning("⚠️ Cadastre pelo menos uma turma antes de registrar estudantes.")
    else:
        with st.form("form_novo_estudante", clear_on_submit=True):
            col_in1, col_in2 = st.columns(2)
            with col_in1:
                nome_estudante = st.text_input("Nome *", placeholder="Ex: João da Silva")
            with col_in2:
                opcoes_turma = {f"{t['nome']} ({t['etapa_nome']})": t['id'] for t in turmas}
                turma_selecionada = st.selectbox("Turma", list(opcoes_turma.keys()))
            
            if st.form_submit_button("Cadastrar Estudante", type="primary"):
                if not nome_estudante.strip():
                    st.error("O nome do estudante é obrigatório.")
                else:
                    criar_estudante(nome_estudante.strip(), opcoes_turma[turma_selecionada])
                    st.success("Estudante cadastrado com sucesso!")
                    st.rerun()

    st.write("<br>", unsafe_allow_html=True)
    st.subheader("Estudantes Cadastrados", divider="gray")
    
    col_filt1, col_filt2 = st.columns([1, 2])
    with col_filt1:
        filtro_turma = st.selectbox("Filtro: Turma", ["Todas"] + [f"{t['nome']} ({t['etapa_nome']})" for t in turmas] if turmas else ["Todas"])
        
    turma_id_filtro = None
    if filtro_turma != "Todas":
        turma_match = next(t for t in turmas if f"{t['nome']} ({t['etapa_nome']})" == filtro_turma)
        turma_id_filtro = turma_match['id']
        
    estudantes = listar_estudantes(turma_id=turma_id_filtro)
    if not estudantes:
        st.info("Nenhum estudante encontrado.")
        return

    # Inicializar estado de edicao
    if 'editando_estud' not in st.session_state:
        st.session_state.editando_estud = None

    for est in estudantes:
        with st.container(border=True):
            col_info, col_btn_edit, col_btn_del = st.columns([6, 1, 1])
            col_info.write(f"**{est['nome']}** — *(Turma: {est['turma_nome']} | {est['etapa_nome']})*")
            
            if col_btn_edit.button("✏️ Editar", key=f"btn_edit_est_{est['id']}", use_container_width=True):
                st.session_state.editando_estud = est['id']
                st.rerun()
                
            if col_btn_del.button("🗑️ Apagar", key=f"btn_del_est_{est['id']}", use_container_width=True):
                excluir_estudante(est['id'])
                st.rerun()

            if st.session_state.editando_estud == est['id']:
                st.divider()
                with st.form(f"form_update_est_{est['id']}"):
                    st.write(f"**Atualizando dados de:** {est['nome']}")
                    
                    novo_nome_e = st.text_input("Novo Nome:", value=est['nome'])
                    
                    opcoes_turma = {f"{t['nome']} ({t['etapa_nome']})": t['id'] for t in turmas}
                    turma_atual = f"{est['turma_nome']} ({est['etapa_nome']})"
                    turma_idx = list(opcoes_turma.keys()).index(turma_atual) if turma_atual in opcoes_turma else 0
                    nova_turma_nome = st.selectbox("Alterar Turma", list(opcoes_turma.keys()), index=turma_idx, key=f"sel_turma_{est['id']}")
                    
                    col_sv, col_cx = st.columns(2)
                    from database.crud import atualizar_estudante
                    if col_sv.form_submit_button("✅ Salvar Alterações", use_container_width=True):
                        if not novo_nome_e.strip():
                            st.error("O nome do aluno não pode ficar vazio.")
                        else:
                            atualizar_estudante(est['id'], novo_nome_e.strip(), opcoes_turma[nova_turma_nome])
                            st.session_state.editando_estud = None
                            st.rerun()
                            
                    if col_cx.form_submit_button("❌ Cancelar", use_container_width=True):
                        st.session_state.editando_estud = None
                        st.rerun()

# ==============================
# PROFESSORES (UNIFICADO)
# ==============================
from database.crud import (
    obter_turmas_prof_reforco, atualizar_prof_reforco,
    obter_turmas_prof_regente, atualizar_prof_regente
)

def _render_prof_card(p, tipo, turmas_map):
    # tipo = 'Reforço' ou 'Regente'
    chave_id = f"{tipo}_{p['id']}"
    
    with st.container(border=True):
        col_info, col_btn_edit, col_btn_del = st.columns([6, 1, 1])
        # Buscando o detalhamento das turmas de quem
        st_t_ids = obter_turmas_prof_reforco(p['id']) if tipo == 'Reforço' else obter_turmas_prof_regente(p['id'])
        nomes_ts = [k for k, v in turmas_map.items() if v in st_t_ids]
        ts_str = ", ".join(nomes_ts) if nomes_ts else "Sem turma vinculada"
        
        badge = "🎯 Reforço" if tipo == 'Reforço' else "📖 Regente"
        area_str = p.get('area', 'Não Definida')
        col_info.markdown(f"**{p['nome']}** &nbsp; `{badge}` &nbsp; *[{area_str}]*  \n*(Turmas: {ts_str})*")
        
        if col_btn_edit.button("✏️ Editar", key=f"btn_edit_prof_{chave_id}", use_container_width=True):
            st.session_state.editando_prof = chave_id
            st.rerun()
            
        if col_btn_del.button("🗑️ Apagar", key=f"btn_del_prof_{chave_id}", use_container_width=True):
            if tipo == 'Reforço':
                excluir_prof_reforco(p['id'])
            else:
                excluir_prof_regente(p['id'])
            st.rerun()

        if st.session_state.get('editando_prof') == chave_id:
            st.divider()
            with st.form(f"form_update_prof_{chave_id}"):
                st.write(f"**Atualizando:** {p['nome']} ({tipo})")
                
                col_up1, col_up2 = st.columns(2)
                with col_up1:
                    novo_nome = st.text_input("Novo Nome:", value=p['nome'])
                with col_up2:
                    current_area = p.get('area', 'Português')
                    idx_area = ["Português", "Matemática", "Outra"].index(current_area) if current_area in ["Português", "Matemática", "Outra"] else 0
                    nova_area = st.selectbox("Área de Atuação:", ["Português", "Matemática", "Outra"], index=idx_area)
                    
                turmas_marcadas = st.multiselect("Alterar Turmas:", list(turmas_map.keys()), default=nomes_ts)
                
                col_sv, col_cx = st.columns(2)
                if col_sv.form_submit_button("✅ Salvar Alterações", use_container_width=True):
                    if not novo_nome.strip() or not turmas_marcadas:
                        st.error("Nome obrigatório e ao menos 1 turma selecionada.")
                    else:
                        novos_ids = [turmas_map[t] for t in turmas_marcadas]
                        if tipo == 'Reforço':
                            atualizar_prof_reforco(p['id'], novo_nome.strip(), nova_area, novos_ids)
                        else:
                            atualizar_prof_regente(p['id'], novo_nome.strip(), nova_area, novos_ids)
                        st.session_state.editando_prof = None
                        st.rerun()
                if col_cx.form_submit_button("❌ Cancelar", use_container_width=True):
                    st.session_state.editando_prof = None
                    st.rerun()


def _render_professores():
    page_header("👨‍🏫 Cadastrar Professores", "Gerencie unificadamente tutores de reforço e regentes.")
    turmas_disponiveis = listar_turmas()
    
    st.subheader("Novo Professor", divider="gray")
    if not turmas_disponiveis:
        st.warning("⚠️ Cadastre turmas antes de associar a um professor.")
    else:
        opcoes_turmas = {f"{t['nome']} ({t['etapa_nome']})": t['id'] for t in turmas_disponiveis}
        
        with st.form("form_novo_prof", clear_on_submit=True):
            col_in1, col_in2 = st.columns(2)
            with col_in1:
                nome = st.text_input("Nome do Professor *")
                area_atuacao = st.selectbox("Área de Ensino *", ["Português", "Matemática"])
            with col_in2:
                tipo = st.selectbox("Categoria *", ["Professor de Reforço", "Professor Regente"])
                turmas_marcadas = st.multiselect("Vinculado às Turmas: *", list(opcoes_turmas.keys()))
                
            if st.form_submit_button("Cadastrar Professor", type="primary"):
                if not nome.strip() or not turmas_marcadas:
                    st.error("Campos com asterisco são obrigatórios.")
                else:
                    turmas_ids = [opcoes_turmas[t] for t in turmas_marcadas]
                    if tipo == "Professor de Reforço":
                        criar_prof_reforco(nome.strip(), area_atuacao, turmas_ids)
                    else:
                        criar_prof_regente(nome.strip(), area_atuacao, turmas_ids)
                    st.success(f"Professor {nome} ({tipo}) cadastrado com sucesso!")
                    st.rerun()

    st.write("<br>", unsafe_allow_html=True)
    st.subheader("Equipe Cadastrada", divider="gray")
    
    profs_reforco = listar_profs_reforco()
    for p in profs_reforco:
        p['_tipo'] = 'Reforço'
        
    profs_regentes = listar_profs_regentes()
    for p in profs_regentes:
        p['_tipo'] = 'Regente'
        
    todos_profs = profs_reforco + profs_regentes
    
    if not todos_profs:
        st.info("Nenhum professor registrado no momento.")
        return
        
    col_filt_p1, col_filt_p2 = st.columns([1, 2])
    with col_filt_p1:
        filtro_tipo = st.selectbox("Filtro: Categoria", ["Todos", "Reforço", "Regente"])
        
    opcoes_turmas_map = {f"{t['nome']} ({t['etapa_nome']})": t['id'] for t in turmas_disponiveis} if turmas_disponiveis else {}
    
    profs_filtrados = [p for p in todos_profs if filtro_tipo == "Todos" or p['_tipo'] == filtro_tipo]
    
    for p in profs_filtrados:
        _render_prof_card(p, p['_tipo'], opcoes_turmas_map)
