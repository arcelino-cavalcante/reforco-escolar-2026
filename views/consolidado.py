import streamlit as st
import datetime
from database.crud import (
    listar_estudantes, obter_turmas_prof_reforco,
    obter_consolidado_trimestre, criar_consolidado_mensal, atualizar_consolidado_mensal,
    listar_profs_reforco, obter_regente_por_turma_e_area, obter_media_diaria_estudante_bimestre,
    ESCALA_COMPREENSAO
)
from utils.styles import page_header

def render():
    page_header("📊 Desempenho Bimestral", "Lançamento oficial das notas e fechamento do ciclo.")

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
    st.markdown(f"#### 📅 Período Avaliativo - {area_prof}")
    col_cab_1, col_cab_2 = st.columns([1, 2])
    with col_cab_1:
        bim_sel = st.selectbox("Selecione o Bimestre de Lançamento:", ["I", "II", "III", "IV"])
    with col_cab_2:
        data_selecionada = st.date_input("Data do Relatório", datetime.date.today())

    turmas_do_prof = obter_turmas_prof_reforco(prof_id) 
    if not turmas_do_prof:
        st.warning("⚠️ Você não está vinculado a nenhuma turma no momento.")
        return

    todos_estudantes = listar_estudantes()
    meus_estudantes = [e for e in todos_estudantes if e['turma_id'] in turmas_do_prof]
    
    if not meus_estudantes:
        st.info("Não há nenhum estudante matriculado nas suas turmas atualmente.")
        return

    opcoes_estudantes = {f"{e['nome']} - {e['turma_nome']}": e for e in meus_estudantes}
    
    st.divider()
    aluno_str = st.selectbox("🎯 Selecione o Estudante para Avaliar:", list(opcoes_estudantes.keys()))
    estudante_data = opcoes_estudantes[aluno_str]
    est_id = estudante_data['id']
    
    # Cruzamento do BD Regente responsavel
    regente_match = obter_regente_por_turma_e_area(estudante_data['turma_id'], area_prof)
    regente_id_bd = regente_match['id'] if regente_match else None
    
    if regente_match:
        st.caption(f"🤝 Relatório Oficial será espelhado no painel do Diretor e do Regente: **{regente_match['nome']}**")

    # Verifica travamento (já fez o trimestal?)
    reg_existente = obter_consolidado_trimestre(est_id, prof_id, bim_sel)
    
    if reg_existente:
        st.success(f"✅ O Consolidado do Bimestre {bim_sel} deste estudante já foi fechado! Você pode alterar as notas abaixo.")
        form_title = f"Edição de Boletim - Bimestre {bim_sel}"
        btn_label = "💾 Salvar Alterações"
    else:
        st.info("Aguardando lançamento oficial...")
        form_title = f"Novo Boletim - Bimestre {bim_sel}"
        btn_label = "🚀 Publicar Relatório Bimestral"

    st.write("<br>", unsafe_allow_html=True)
    with st.container(border=True):
        st.subheader(form_title)
        
        with st.form("form_consolidacao"):
            # VARIAVEIS
            m_adi = m_sub = m_mul = m_div = m_res = None
            p_esc = p_lei = p_int = p_pon = None
            
            # Cálculo de IA / Sugestão baseada em Histórico (escala unificada 1-4)
            media_diaria = obter_media_diaria_estudante_bimestre(est_id, prof_id, bim_sel)
            # Converter média 1-4 para escala 1-10 para os campos de nota
            if media_diaria is not None:
                fallback_val = max(1, min(10, round(media_diaria * 2.5)))
            else:
                fallback_val = 5
            
            if media_diaria is not None and not reg_existente:
                nivel_texto = ESCALA_COMPREENSAO[min(3, max(0, round(media_diaria) - 1))]
                st.caption(f"🤖 *Nota: Sugestão baseada na média diária de **{media_diaria}/4** ({nivel_texto}) nos Diários do bimestre.*")
            
            # BLOCO MATEMÁTICA
            if area_prof == "Matemática":
                st.markdown("##### 🧮 Habilidades Matemáticas (Escala de 1 a 10)")
                c1, c2, c3 = st.columns(3)
                c4, c5, _ = st.columns(3)
                
                with c1: m_adi = st.number_input("Adição", 1, 10, reg_existente.get('mat_adicao', fallback_val) if reg_existente else fallback_val)
                with c2: m_sub = st.number_input("Subtração", 1, 10, reg_existente.get('mat_subtracao', fallback_val) if reg_existente else fallback_val)
                with c3: m_mul = st.number_input("Multiplicação", 1, 10, reg_existente.get('mat_multiplicacao', fallback_val) if reg_existente else fallback_val)
                with c4: m_div = st.number_input("Divisão", 1, 10, reg_existente.get('mat_divisao', fallback_val) if reg_existente else fallback_val)
                with c5: m_res = st.number_input("Resolução de Problemas", 1, 10, reg_existente.get('mat_resolucao', fallback_val) if reg_existente else fallback_val)
                
            # BLOCO PORTUGUÊS
            elif area_prof == "Português":
                st.markdown("##### 📝 Habilidades de Linguagem (Escala de 1 a 10)")
                c1, c2 = st.columns(2)
                c3, c4 = st.columns(2)
                
                with c1: p_esc = st.number_input("Nível de Escrita", 1, 10, reg_existente.get('port_escrita', fallback_val) if reg_existente else fallback_val)
                with c2: p_lei = st.number_input("Nível de Leitura", 1, 10, reg_existente.get('port_leitura', fallback_val) if reg_existente else fallback_val)
                with c3: p_int = st.number_input("Interpretação Textual", 1, 10, reg_existente.get('port_interpretacao', fallback_val) if reg_existente else fallback_val)
                with c4: p_pon = st.number_input("Pontuação e Acentuação", 1, 10, reg_existente.get('port_pontuacao', fallback_val) if reg_existente else fallback_val)
                
            # OUTROS (Failsafe)
            else:
                st.warning("⚠️ Sua área não está configurada como 'Português' nem 'Matemática'. Preencha os dados genéricos abaixo.")
            
            st.write("---")
            st.write("---")
            st.markdown("##### 🔎 Desfecho Final Pedagógico (Cirúrgico)")
            
            opcoes_desfecho = ["Avançou bastante", "Avançou parcialmente", "Não conseguiu avançar (Estagnado)"]
            c_val_des = reg_existente.get('parecer_evolutivo', "Avançou parcialmente") if reg_existente else "Avançou parcialmente"
            idx_des = opcoes_desfecho.index(c_val_des) if c_val_des in opcoes_desfecho else 1
            
            parecer_evolutivo = st.selectbox("Situação do Aprendizado do Aluno neste Bimestre:", opcoes_desfecho, index=idx_des)

            val_alta = reg_existente.get('recomendacao_alta', False) if reg_existente else False
            recomendacao_alta = st.toggle("🎓 RECOMENDAR ALTA DO REFORÇO?", value=val_alta, help="Ative isso se o aluno atingiu a fluência mínima necessária para acompanhar a sala de aula regular sozinho.")
            
            if recomendacao_alta:
                st.success("🎉 Que excelente notícia! O aluno voltará 100% para a sala regular.")
                
            val_acao = reg_existente.get('acao_pedagogica', "") if reg_existente else ""
            acao_pedagogica = st.text_area("📌 Ação Pedagógica Sugerida para o Professor Regente:", value=val_acao, placeholder="Ex: Manter ele sentado nas primeiras fileiras, não deixar esquecer tabuada de 8.")

            obs_padrao = reg_existente.get('observacao_geral', "") if reg_existente else ""
            observacao_geral = st.text_area("Observação Geral Privada do Reforço (Opcional):", value=obs_padrao)
            
            st.write("<br>", unsafe_allow_html=True)
            if st.form_submit_button(btn_label, type="primary", use_container_width=True):
                if reg_existente:
                    atualizar_consolidado_mensal(
                        id_resumo=reg_existente['id'],
                        data_registro=data_selecionada.isoformat(),
                        mat_adicao=m_adi, mat_subtracao=m_sub, mat_multiplicacao=m_mul, mat_divisao=m_div, mat_resolucao=m_res,
                        port_escrita=p_esc, port_leitura=p_lei, port_interpretacao=p_int, port_pontuacao=p_pon,
                        parecer_evolutivo=parecer_evolutivo,
                        observacao_geral=observacao_geral.strip(),
                        recomendacao_alta=recomendacao_alta,
                        acao_pedagogica=acao_pedagogica.strip() if acao_pedagogica else None
                    )
                else:
                    criar_consolidado_mensal(
                        estudante_id=est_id, prof_id=prof_id, prof_regente_id=regente_id_bd,
                        data_registro=data_selecionada.isoformat(), bimestre=bim_sel,
                        mat_adicao=m_adi, mat_subtracao=m_sub, mat_multiplicacao=m_mul, mat_divisao=m_div, mat_resolucao=m_res,
                        port_escrita=p_esc, port_leitura=p_lei, port_interpretacao=p_int, port_pontuacao=p_pon,
                        parecer_evolutivo=parecer_evolutivo,
                        observacao_geral=observacao_geral.strip(),
                        recomendacao_alta=recomendacao_alta,
                        acao_pedagogica=acao_pedagogica.strip() if acao_pedagogica else None
                    )
                st.rerun()
