import streamlit as st
import datetime
from database.crud import (
    listar_estudantes, obter_turmas_prof_reforco, listar_turmas,
    criar_registro_diario, atualizar_registro_diario, excluir_registro_diario,
    listar_registros_diarios, listar_profs_reforco, 
    obter_regente_por_turma_e_area, obter_encaminhamentos_pendentes, concluir_encaminhamento,
    contar_presencas_estudante
)
from utils.styles import page_header

HABILIDADES_MATEMATICA = ["Adição", "Subtração", "Divisão", "Multiplicação", "Resolução de problemas simples", "Outro"]
HABILIDADES_PORTUGUES = ["Leitura e Compreensão Textual", "Produção de Texto (Escrita)", "Ortografia e Gramática", "Fluência Leitora", "Caligrafia e Traçado", "Interpretação Avançada", "Vocabulário", "Outro"]
MOTIVOS_FALTA = ["Atestado Médico / Doença", "Problema de Transporte", "Falta do Professor (Sua falta)", "Feriado / Recesso", "Esqueceu do Reforço", "Evento na Escola", "Outro Motivo"]
NIVEIS_ENGAJAMENTO = ["Muito Focado e Participativo", "Participação Regular", "Desatento / Disperso", "Agitado / Inquieto", "Recusou-se a Realizar Tarefas"]
TIPOS_ATIVIDADE = ["Impressa", "Atividade Lúdica", "Jogo", "Atividade em Grupo", "Outro"]
ESTADOS_EMOCIONAIS = ["Não Observado", "Tranquilo / Calmo", "Triste / Apático", "Irritado / Frustrado", "Ansioso", "Eufórico / Muito Agitado"]

def render():
    page_header("📝 Ficha Diária", "Acompanhe e cruze dados vitais de Reforço x Sala de Aula.")

    prof_id = st.session_state.get('prof_id')
    if prof_id is None:
        st.error("Erro de sessão: Professor não logado.")
        return

    # Info Prof
    lista_profs = listar_profs_reforco()
    prof_atual = next((p for p in lista_profs if p['id'] == prof_id), None)
    if not prof_atual:
        st.error("Erro: Dados do professor não encontrados.")
        return
    area_prof = prof_atual.get('area', 'Geral')

    # Controls Header
    st.markdown(f"#### 🎓 Novo Lançamento - {area_prof}")

    turmas_do_prof = obter_turmas_prof_reforco(prof_id) 
    if not turmas_do_prof:
        st.warning("⚠️ Você não está vinculado a nenhuma turma no momento.")
        return
        
    todas_turmas_bd = listar_turmas()
    turmas_obj = {t['nome']: t for t in todas_turmas_bd if t['id'] in turmas_do_prof}

    col_cab_1, col_cab_2, col_cab_3 = st.columns([1, 1, 2])
    with col_cab_1:
        bim_sel = st.selectbox("Selecione o Bimestre:", ["I", "II", "III", "IV"])
    with col_cab_2:
        data_selecionada = st.date_input("Data do Registro", datetime.date.today())
    with col_cab_3:
        opcoes_filtro_turma = ["Todas as Turmas"] + list(turmas_obj.keys())
        turma_sel = st.selectbox("Filtrar por Turma:", opcoes_filtro_turma)

    todos_estudantes = listar_estudantes()
    meus_estudantes = [e for e in todos_estudantes if e['turma_id'] in turmas_do_prof]
    
    if turma_sel != "Todas as Turmas":
        meus_estudantes = [e for e in meus_estudantes if e['turma_id'] == turmas_obj[turma_sel]['id']]
    
    if not meus_estudantes:
        st.info("Não há nenhum estudante matriculado nesta seleção de turma.")
        return

    registros_do_dia = listar_registros_diarios(data_selecionada.isoformat(), prof_id)
    if turma_sel != "Todas as Turmas":
        registros_do_dia = [r for r in registros_do_dia if r['turma_nome'] == turma_sel]
        
    ids_atendidos = [r['estudante_id'] for r in registros_do_dia]
    alvos_pendentes = [e for e in meus_estudantes if e['id'] not in ids_atendidos]

    # ==============================
    # ANDAR 1: INSERÇÃO
    # ==============================
    with st.container(border=True):
        st.subheader("1️⃣ Fila do Dia", divider="gray")
        if not alvos_pendentes:
            st.success("🎉 Todos os alunos pendentes de suas turmas já foram mapeados para esta data.")
        else:
            opcoes_estudantes = {f"{e['nome']} - {e['turma_nome']}": e for e in alvos_pendentes}
            
            aluno_str = st.selectbox("Selecione o Estudante:", list(opcoes_estudantes.keys()))
            estudante_data = opcoes_estudantes[aluno_str]
            
            regente_match = obter_regente_por_turma_e_area(estudante_data['turma_id'], area_prof)
            regente_id_bd = regente_match['id'] if regente_match else None
            
            if regente_match:
                st.caption(f"🤝 **Parceria Ativa:** Vinculando ao Regente de {area_prof}: **{regente_match['nome']}**")
            
            with st.form("form_registro_fixo", clear_on_submit=False):
                compareceu = st.radio("Aluno Compareceu ao Reforço?", ["Sim", "Não"], horizontal=True)
                
                motivo_falta = None
                origem_conteudo = None
                hab_conteudo = None
                nivel_comp = 0
                participacao = None
                observacao = None
                tipo_atividade = None
                estado_emocional = None
                dificuldade_latente = None
                
                if compareceu == "Não":
                    motivo_falta = st.selectbox("Motivo da Ausência:", MOTIVOS_FALTA)
                else:
                    origem_conteudo = st.selectbox("O que foi trabalhado no dia?", ["Conteúdo base do Reforço", "Conteúdo da Sala de Aula"])
                    
                    if area_prof == "Matemática":
                        hab_opcoes = HABILIDADES_MATEMATICA
                        hab_sel = st.multiselect(f"Qual habilidade de Matemática? (Pode escolher mais de uma) *", hab_opcoes)
                        if "Outro" in hab_sel:
                            hab_conteudo_outro = st.text_input("Especifique a Habilidade *")
                            hab_conteudo = ", ".join([h for h in hab_sel if h != "Outro"] + ([hab_conteudo_outro] if hab_conteudo_outro else []))
                        else:
                            hab_conteudo = ", ".join(hab_sel)
                    else:
                        if area_prof == "Português":
                            hab_opcoes = HABILIDADES_PORTUGUES
                        else:
                            hab_opcoes = ["Geral", "Outro"]
                            
                        hab_sel = st.selectbox(f"Qual habilidade de {area_prof}? *", hab_opcoes)
                        if hab_sel == "Outro":
                            hab_conteudo = st.text_input("Especifique a Habilidade *")
                        else:
                            hab_conteudo = hab_sel
                    
                    c_t, c_e = st.columns(2)
                    with c_t:
                        tipo_atividade = st.selectbox("Tipo de Atividade:", TIPOS_ATIVIDADE)
                    with c_e:
                        estado_emocional = st.selectbox("Estado Emocional (Opcional):", ESTADOS_EMOCIONAIS)
                    
                    c_n1, c_n2 = st.columns(2)
                    with c_n1:
                        nivel_comp = st.selectbox("Compreensão da Habilidade:", [
                            "Não compreendeu a habilidade",
                            "Compreendeu com muita intervenção",
                            "Compreendeu com pouca intervenção",
                            "Autônomo (Domínio total)"
                        ])
                    with c_n2:
                        participacao = st.selectbox("Engajamento/Comportamento:", NIVEIS_ENGAJAMENTO)
                        
                    if nivel_comp != "Autônomo (Domínio total)":
                        dificuldade_latente = st.text_input("⚠️ Dificuldade Latente Hoje:", placeholder="Ex: Errou a regra dos sinais de matemática na prática.", help="Crucial para guiar a escola sobre o que bloquear o aluno amanhã.")

                    observacao = st.text_area("Observação Geral da Aula / Dificuldades")
                
                if st.form_submit_button("✅ Salvar Ficha", use_container_width=True):
                    if compareceu == "Sim" and not hab_conteudo.strip():
                        st.error('Preencha a habilidade trabalhada!')
                    else:
                        criar_registro_diario(
                            estudante_id=estudante_data['id'],
                            prof_id=prof_id,
                            data_registro=data_selecionada.isoformat(),
                            bimestre=bim_sel,
                            prof_regente_id=regente_id_bd,
                            compareceu=1 if compareceu == "Sim" else 0,
                            motivo_falta=motivo_falta,
                            origem_conteudo=origem_conteudo,
                            habilidade_trabalhada=hab_conteudo.strip() if hab_conteudo else None,
                            nivel_compreensao=nivel_comp,
                            participacao=participacao,
                            observacao=observacao.strip() if observacao else None,
                            dificuldade_latente=dificuldade_latente.strip() if dificuldade_latente else None,
                            tipo_atividade=tipo_atividade,
                            estado_emocional=estado_emocional if estado_emocional != "Não Observado" else None
                        )
                        st.rerun()

    # ==============================
    # ANDAR 2: ESTUDANTES JÁ ATENDIDOS HOJE
    # ==============================
    st.write("<br>", unsafe_allow_html=True)
    st.subheader(f"2️⃣ Estudantes Já Atendidos Hoje ({len(registros_do_dia)})", divider="gray")
    
    if not registros_do_dia:
        st.info("Nenhum relato gravado para atestados no dia de hoje.")
    else:
        if 'editando_rd' not in st.session_state:
            st.session_state.editando_rd = None
            
        for reg in registros_do_dia:
            # Puxamos pendencias desse estundante especifico
            pendencias_reg = obter_encaminhamentos_pendentes(reg['estudante_id'], area_prof)
            qtd_p = len(pendencias_reg)
            alerta_str = f" ⚠️ ({qtd_p} pedido{'s' if qtd_p > 1 else ''} regente)" if qtd_p > 0 else ""
            
            total_presencas = contar_presencas_estudante(reg['estudante_id'], prof_id)
            
            c_bool = reg['compareceu'] == 1
            ic = "🟢" if c_bool else "🔴"
            
            titulo_expander = f"{ic} {reg['estudante_nome']} — {reg['turma_nome']} {alerta_str}"
            
            with st.expander(titulo_expander):
                st.caption(f"**Total de Atendimentos no Histórico:** {total_presencas} presença(s)")
                
                # Se tiver notificações, printa aqui limpo pra ser resolvido
                if qtd_p > 0:
                    for penc in pendencias_reg:
                        p_dt = datetime.datetime.strptime(penc['data_solicitacao'], '%Y-%m-%d').strftime('%d/%m/%Y')
                        st.warning(f"⚠️ **Pedido do Regente ({penc['regente_nome']}) em {p_dt}:** Focar em **'{penc['habilidade_foco']}'**  \n*Obs: {penc['observacao']}*")
                        
                        with st.form(f"form_resp_enc_{penc['id']}"):
                            resp = st.text_area("Resposta/Feedback ao Regente (Opcional):", placeholder="Escreva aqui como foi a evolução da habilidade...")
                            if st.form_submit_button("✅ Marcar como Atendido e Enviar Resposta", use_container_width=True):
                                concluir_encaminhamento(penc['id'], resposta=resp.strip() if resp else None)
                                st.rerun()
                    st.divider()

                col_txt, col_btn_edit, col_btn_del = st.columns([10, 1, 1])
                
                if c_bool:
                    col_txt.markdown(f"*Lançado:* {reg['origem_conteudo']} - **{reg['habilidade_trabalhada']}**")
                else:
                    col_txt.markdown(f"*(Falta: {reg['motivo_falta']})*")
                    
                if col_btn_edit.button("✏️ Editar", key=f"btn_edit_{reg['id']}", use_container_width=True):
                    st.session_state.editando_rd = reg['id']
                    st.session_state.pop('confirmando_exclusao_rd', None)
                    st.rerun()
                
                if col_btn_del.button("🗑️", key=f"btn_del_{reg['id']}", use_container_width=True):
                    st.session_state.confirmando_exclusao_rd = reg['id']
                    st.session_state.editando_rd = None
                    st.rerun()

            # Confirmação de exclusão
            if st.session_state.get('confirmando_exclusao_rd') == reg['id']:
                st.warning(f"⚠️ Tem certeza que deseja **excluir** o registro de **{reg['estudante_nome']}** ({reg.get('data_registro', '')})? Esta ação é irreversível.")
                col_conf_s, col_conf_n = st.columns(2)
                if col_conf_s.button("✅ Sim, excluir", key=f"conf_del_{reg['id']}", type="primary", use_container_width=True):
                    excluir_registro_diario(reg['id'])
                    st.session_state.confirmando_exclusao_rd = None
                    st.rerun()
                if col_conf_n.button("❌ Cancelar", key=f"canc_del_{reg['id']}", use_container_width=True):
                    st.session_state.confirmando_exclusao_rd = None
                    st.rerun()

            # Painel de Edição Expansivo
            if st.session_state.editando_rd == reg['id']:
                st.divider()
                with st.form(f"form_upd_{reg['id']}"):
                    st.write(f"**Corrigindo Ficha de:** {reg['estudante_nome']}")
                    
                    e_comp = st.radio("Compareceu?", ["Sim", "Não"], index=0 if c_bool else 1, horizontal=True, key=f"rdo_{reg['id']}")
                    
                    e_m = None
                    e_ori = None
                    e_hab = None
                    e_niv = 0
                    e_part = None
                    e_obs = None
                    e_tipo = None
                    e_emoc = None
                    e_dif = None
                    
                    if e_comp == "Não":
                        val_mot = reg.get('motivo_falta')
                        idx_mot = MOTIVOS_FALTA.index(val_mot) if val_mot in MOTIVOS_FALTA else (len(MOTIVOS_FALTA)-1 if val_mot else 0)
                        e_m = st.selectbox("Motivo?", MOTIVOS_FALTA, index=idx_mot, key=f"m_{reg['id']}")
                    else:
                        idx_ori = ["Conteúdo base do Reforço", "Conteúdo da Sala de Aula"].index(reg['origem_conteudo']) if reg['origem_conteudo'] in ["Conteúdo base do Reforço", "Conteúdo da Sala de Aula"] else 0
                        e_ori = st.selectbox("Origem?", ["Conteúdo base do Reforço", "Conteúdo da Sala de Aula"], index=idx_ori, key=f"o_{reg['id']}")
                        
                        h_atual = reg['habilidade_trabalhada'] if reg['habilidade_trabalhada'] else ""
                        
                        if area_prof == "Matemática":
                            hab_opcoes_e = HABILIDADES_MATEMATICA
                            h_atual_list = [h.strip() for h in h_atual.split(",")] if h_atual else []
                            default_sel = [h for h in h_atual_list if h in hab_opcoes_e]
                            has_outro = any(h for h in h_atual_list if h and h not in hab_opcoes_e)
                            if has_outro and "Outro" not in default_sel:
                                default_sel.append("Outro")
                                
                            h_sel_e = st.multiselect("Habilidade(s)?", hab_opcoes_e, default=default_sel, key=f"hsel_{reg['id']}")
                            if "Outro" in h_sel_e:
                                outro_val = ", ".join([h for h in h_atual_list if h and h not in hab_opcoes_e])
                                e_hab_outro = st.text_input("Especifique o Outro:", value=outro_val, key=f"htxt_{reg['id']}")
                                e_hab = ", ".join([h for h in h_sel_e if h != "Outro"] + ([e_hab_outro] if e_hab_outro else []))
                            else:
                                e_hab = ", ".join(h_sel_e)
                        else:
                            if area_prof == "Português":
                                hab_opcoes_e = HABILIDADES_PORTUGUES
                            else:
                                hab_opcoes_e = ["Geral", "Outro"]
                            
                            idx_hab = hab_opcoes_e.index(h_atual) if h_atual in hab_opcoes_e else (len(hab_opcoes_e)-1 if h_atual else 0)
                            
                            h_sel_e = st.selectbox("Habilidade?", hab_opcoes_e, index=idx_hab, key=f"hsel_{reg['id']}")
                            if h_sel_e == "Outro":
                                e_hab = st.text_input("Especifique:", value=h_atual if h_atual not in hab_opcoes_e else "", key=f"htxt_{reg['id']}")
                            else:
                                e_hab = h_sel_e
                            
                        c_te, c_ee = st.columns(2)
                        with c_te:
                            val_tipo = reg.get('tipo_atividade') or TIPOS_ATIVIDADE[0]
                            idx_tipo = TIPOS_ATIVIDADE.index(val_tipo) if val_tipo in TIPOS_ATIVIDADE else 0
                            e_tipo = st.selectbox("Tipo de Atividade:", TIPOS_ATIVIDADE, index=idx_tipo, key=f"tipo_{reg['id']}")
                        with c_ee:
                            val_emoc = reg.get('estado_emocional') or "Não Observado"
                            idx_emoc = ESTADOS_EMOCIONAIS.index(val_emoc) if val_emoc in ESTADOS_EMOCIONAIS else 0
                            e_emoc = st.selectbox("Estado Emocional:", ESTADOS_EMOCIONAIS, index=idx_emoc, key=f"emoc_{reg['id']}")
                        
                        cc1, cc2 = st.columns(2)
                        with cc1:
                            val_niv = reg.get('nivel_compreensao')
                            opcoes_comp = ["Não compreendeu a habilidade", "Compreendeu com muita intervenção", "Compreendeu com pouca intervenção", "Autônomo (Domínio total)"]
                            idx_niv = opcoes_comp.index(val_niv) if val_niv in opcoes_comp else 0
                            e_niv = st.selectbox("Compreensão", opcoes_comp, index=idx_niv, key=f"niv_{reg['id']}")
                        with cc2:
                            val_part = reg.get('participacao') or NIVEIS_ENGAJAMENTO[1]
                            idx_part = NIVEIS_ENGAJAMENTO.index(val_part) if val_part in NIVEIS_ENGAJAMENTO else 1
                            e_part = st.selectbox("Atenção:", NIVEIS_ENGAJAMENTO, index=idx_part, key=f"part_{reg['id']}")
                            
                        if e_niv != "Autônomo (Domínio total)":
                            val_dif = reg.get('dificuldade_latente') or ""
                            e_dif = st.text_input("Gargalo hoje:", value=val_dif, key=f"dif_{reg['id']}")
                            
                        val_obs = reg.get('observacao') or ""
                        e_obs = st.text_area("Observação Geral:", value=val_obs, key=f"obs_{reg['id']}")
                        
                    c_s, c_c = st.columns(2)
                    if c_s.form_submit_button("💾 Salvar Correção", use_container_width=True):
                        if e_comp == "Sim" and not e_hab.strip():
                            st.error("Habilidade em branco.")
                        else:
                            atualizar_registro_diario(
                                id_reg=reg['id'],
                                compareceu=1 if e_comp == "Sim" else 0,
                                motivo_falta=e_m,
                                origem_conteudo=e_ori,
                                habilidade_trabalhada=e_hab.strip() if e_hab else None,
                                nivel_compreensao=e_niv,
                                participacao=e_part,
                                observacao=e_obs.strip() if e_obs else None,
                                dificuldade_latente=e_dif.strip() if e_dif else None,
                                tipo_atividade=e_tipo,
                                estado_emocional=e_emoc if e_emoc != "Não Observado" else None
                            )
                            st.session_state.editando_rd = None
                            st.rerun()
                    if c_c.form_submit_button("❌ Cancelar", use_container_width=True):
                        st.session_state.editando_rd = None
                        st.rerun()
