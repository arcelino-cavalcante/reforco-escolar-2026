import streamlit as st
import datetime
from database.crud import (
    listar_registros_por_regente, listar_turmas, obter_turmas_prof_regente, 
    criar_encaminhamento, listar_encaminhamentos_enviados_estudante,
    marcar_encaminhamento_lido_regente, listar_consolidados_por_regente,
    compreensao_label, compreensao_emoji
)
from utils.styles import page_header

def render():
    page_header("👩‍🏫 Painel da Turma - Visão Regente", "Acompanhe todo o trajeto dos seus alunos no Reforço em tempo real.")

    prof_id = st.session_state.get('prof_id')
    if prof_id is None:
        st.error("Acesso negado: Você não está logado como regente.")
        return

    turmas_do_regente_ids = obter_turmas_prof_regente(prof_id)
    todas_turmas = listar_turmas()
    
    # Faz cruzamento
    turmas_obj = [t for t in todas_turmas if t['id'] in turmas_do_regente_ids]
    
    if not turmas_obj:
        st.warning("Você não está lotado(a) como professor titular em nenhuma turma atualmente. Fale com a Coordenação.")
        return

    # Barra lateral de Filtro
    bim_filtro = st.selectbox("Consultar Bimestre:", ["Todos", "I", "II", "III", "IV"])
    
    st.write("<br>", unsafe_allow_html=True)

    # Coleta de Banco unificada (evita chamar banco N vezes)
    dados = listar_registros_por_regente(prof_id, bim_filtro)
    consolidados_gerais = listar_consolidados_por_regente(prof_id, bim_filtro)
    
    if not dados and not consolidados_gerais:
        st.info(f"Nenhum lançamento constado pela equipe do Reforço Escolar para suas turmas no Bimestre {bim_filtro}.")
        return

    # Tabs (Uma aba pra cada Turma que o regente atua)
    tabs_labels = [f"{t['nome']} ({t['etapa_nome']})" for t in turmas_obj]
    abas = st.tabs(tabs_labels)
    
    for idx, (aba, t_obj) in enumerate(zip(abas, turmas_obj)):
        with aba:
            dados_turma = [d for d in dados if d['turma_id'] == t_obj['id']]
            
            if not dados_turma:
                st.write("*(Nenhum dado lançado para esta turma)*")
                continue
            
            # --- PAINEL GERAL DA TURMA ---
            st.subheader("📈 Panorama de Evolução da Turma")
            import pandas as pd
            import plotly.express as px
            df_t = pd.DataFrame(dados_turma)
            if not df_t.empty and 'compareceu' in df_t.columns:
                df_pres = df_t[df_t['compareceu'] == 1].copy()
                if not df_pres.empty:
                    df_pres['nivel_compreensao'] = df_pres['nivel_compreensao'].fillna("Não Avaliado")
                    comp_counts = df_pres['nivel_compreensao'].value_counts().reset_index()
                    comp_counts.columns = ['Nível', 'Qtd (Aulas)']
                    fig_class = px.bar(comp_counts, x='Qtd (Aulas)', y='Nível', orientation='h', color='Nível', title="Níveis de Compreensão (Aulas da Turma)")
                    st.plotly_chart(fig_class, use_container_width=True)
                else:
                    st.info("Todos os registros lançados são de faltas.")
            
            st.divider()
            st.subheader("Detalhes Individuais por Estudante")
                
            # Extrair alunos únicos (que passaram no reforço) desta turma
            aluno_ids = list(set([d['estudante_id'] for d in dados_turma]))
            
            for a_id in aluno_ids:
                # Localizar nome dele pra colocar no Accordion/Expander
                nome_aluno_str = next(d['estudante_nome'] for d in dados_turma if d['estudante_id'] == a_id)
                historico_aluno = [d for d in dados_turma if d['estudante_id'] == a_id]
                consolidados_aluno = [c for c in consolidados_gerais if c['estudante_id'] == a_id]
                
                # Exibir um expander pra cada criança com a badge da qtd de diários
                with st.expander(f"🧑‍🎓 {nome_aluno_str}  —  ({len(historico_aluno)} lançamentos)"):
                    
                    if consolidados_aluno:
                        st.markdown("#### 📋 Fechamento Bimestral (Conselho de Reforço)")
                        for cons in consolidados_aluno:
                            if cons.get('recomendacao_alta'):
                                st.success(f"🎓 **URGENTE: ALTA SUGERIDA (Bim {cons['bimestre']})**  \nOs professores de reforço indicam que este aluno atingiu autonomia suficiente!")
                            else:
                                st.info(f"**Situação Bimestral ({cons['bimestre']}):** {cons.get('parecer_evolutivo')}")
                            
                            if cons.get('acao_pedagogica'):
                                st.warning(f"📌 **Ação Pedagógica Sugerida para Você na Sala Regular:**  \n{cons.get('acao_pedagogica')}")
                                
                        st.divider()

                    st.write(f"**Diário Contínuo:**")
                    
                    # Tabela/Timeline visual dos relatos de cima (novo) para baixo (velho)
                    for log in historico_aluno:
                        data_f = datetime.datetime.strptime(log['data_registro'], '%Y-%m-%d').strftime('%d/%m/%Y')
                        
                        col_dt, col_det = st.columns([2, 8])
                        with col_dt:
                            st.caption(f"**{data_f}**  \nBim {log['bimestre']}")
                        with col_det:
                            if log['compareceu'] == 1:
                                obs = f" \n*Obs: {log['observacao']}*" if log['observacao'] else ""
                                pt = log.get('participacao', 'Não especificado')
                                nv_raw = log.get('nivel_compreensao', 0)
                                nv_label = compreensao_label(nv_raw)
                                nv_emoji = compreensao_emoji(nv_raw)
                                st.markdown(f"🟢 **{log['origem_conteudo']}**  \n*{log['habilidade_trabalhada']}*  \nCompreensão: {nv_emoji} **{nv_label}** | Foco: {pt}{obs}  \n`Professor: {log['prof_reforco_nome']} ({log['prof_reforco_area']})`")
                            else:
                                st.markdown(f"🔴 **Ausente**  \n*{log['motivo_falta']}*  \n`Lançado por: {log['prof_reforco_nome']} ({log['prof_reforco_area']})`")
                        
                        st.write("---")
                    
                    # STATUS DOS ENCAMINHAMENTOS ENVIADOS
                    historico_enc = listar_encaminhamentos_enviados_estudante(a_id, prof_id)
                    if historico_enc:
                        st.write("#### 📥 Status dos Encaminhamentos")
                        for enc in historico_enc:
                            dt_enc = datetime.datetime.strptime(enc['data_solicitacao'], '%Y-%m-%d').strftime('%d/%m/%Y')
                            if enc['status'] == 'PENDENTE':
                                st.warning(f"🟡 **Enviado em {dt_enc}:** Foco em '{enc['habilidade_foco']}' (Aguardando Retorno)")
                            elif enc['status'] == 'ATENDIDO_PELO_REFORCO':
                                with st.container(border=True):
                                    st.success(f"🟢 **Respondido pelo Reforço (Foco em '{enc['habilidade_foco']}')**")
                                    st.write(f"**Re:** {enc['resposta_reforco'] if enc['resposta_reforco'] else '*Marcou como concluído sem comentário escrito*.'}")
                                    if st.button("✅ Estou Ciente da Resposta", key=f"btn_ciente_{enc['id']}"):
                                        marcar_encaminhamento_lido_regente(enc['id'])
                                        st.rerun()
                            elif enc['status'] == 'LIDO_PELO_REGENTE':
                                st.caption(f"🔕 *Histórico ({dt_enc}): Foco em '{enc['habilidade_foco']}' revolvido.*")
                        st.write("---")

                    # Botão e formulário para NOVO ENCAMINHAMENTO
                    st.write("#### 📤 Solicitar Foco no Reforço")
                    st.info("Utilize este espaço para pedir que o professor de reforço foque em uma habilidade específica com este aluno nas próximas aulas.")
                    with st.form(f"form_enc_{a_id}"):
                        c_area, c_hab = st.columns(2)
                        with c_area:
                            alvo_area = st.selectbox("Área Alvo:", ["Matemática", "Português"])
                        with c_hab:
                            habilidade = st.text_input("Qual o foco necessário? (Ex: Frações, Ortografia)")
                        
                        obs_enc = st.text_area("Observações para o Prof. de Reforço:")
                        
                        if st.form_submit_button("Enviar Solicitação para o Reforço 🚀", use_container_width=True):
                            if not habilidade.strip():
                                st.error("Você precisa informar a habilidade foco!")
                            else:
                                criar_encaminhamento(
                                    estudante_id=a_id,
                                    regente_id=prof_id,
                                    alvo_area=alvo_area,
                                    habilidade_foco=habilidade.strip(),
                                    observacao=obs_enc.strip(),
                                    data_solicitacao=datetime.date.today().isoformat()
                                )
                                st.success("Aviso enviado! O professor de reforço verá este alerta em seu diário.")
                                
