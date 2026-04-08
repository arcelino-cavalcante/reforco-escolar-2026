import streamlit as st
import datetime
from database.crud import (
    listar_registros_diarios_trinta_dias, 
    listar_consolidados_por_prof_reforco,
    obter_turmas_prof_reforco,
    listar_turmas
)
from utils.styles import page_header

def render():
    page_header("📜 Histórico de Registros", "Consulte seus lançamentos diários e mensais recentes.")

    prof_id = st.session_state.get('prof_id')
    if not prof_id:
        st.error("Erro de sessão: Professor não logado.")
        return

    tab_diario, tab_mensal = st.tabs(["📅 Registro Diário (30 dias)", "📊 Registro Mensal"])

    # ===== TAB: REGISTRO DIÁRIO =====
    with tab_diario:
        st.subheader("Histórico Diário por Turma")
        
        turmas_ids = obter_turmas_prof_reforco(prof_id)
        if not turmas_ids:
            st.warning("Você não está vinculado a nenhuma turma.")
        else:
            todas_turmas = listar_turmas()
            turmas_prof = [t for t in todas_turmas if t['id'] in turmas_ids]
            
            turma_nomes = {t['nome']: t['id'] for t in turmas_prof}
            turma_sel = st.selectbox("Selecione a Turma:", list(turma_nomes.keys()))
            
            if turma_sel:
                turma_id = turma_nomes[turma_sel]
                registros = listar_registros_diarios_trinta_dias(prof_id, turma_id)
                
                if not registros:
                    st.info("Nenhum registro encontrado nos últimos 30 dias para esta turma.")
                else:
                    # Agrupar registros por data para uma visualização mais organizada
                    datas = sorted(list(set([r['data_registro'] for r in registros])), reverse=True)
                    
                    for data in datas:
                        data_formatada = datetime.datetime.strptime(data, '%Y-%m-%d').strftime('%d/%m/%Y')
                        with st.expander(f"📅 Dia {data_formatada}"):
                            regs_do_dia = [r for r in registros if r['data_registro'] == data]
                            for r in regs_do_dia:
                                col_info, col_status = st.columns([4, 1])
                                with col_info:
                                    st.write(f"**{r['estudante_nome']}**")
                                    if r['compareceu'] == 1:
                                        st.caption(f"Habilidade: {r['habilidade_trabalhada']} | Compreensão: {r['nivel_compreensao']}/10")
                                        if r['observacao']:
                                            st.markdown(f"*Obs: {r['observacao']}*")
                                    else:
                                        st.caption(f"Faltou: {r['motivo_falta']}")
                                
                                with col_status:
                                    st.write("🟢 Presente" if r['compareceu'] == 1 else "🔴 Falta")
                                st.divider()

    # ===== TAB: REGISTRO MENSAL =====
    with tab_mensal:
        st.subheader("Histórico de Consolidados Mensais")
        consolidados = listar_consolidados_por_prof_reforco(prof_id)
        
        if not consolidados:
            st.info("Nenhum registro mensal encontrado.")
        else:
            for c in consolidados:
                data_ref = datetime.datetime.strptime(c['data_registro'], '%Y-%m-%d').strftime('%d/%m/%Y')
                with st.expander(f"📊 {c['estudante_nome']} - {c['turma_nome']} (Bimestre {c['bimestre']})"):
                    st.write(f"**Data de Lançamento:** {data_ref}")
                    
                    col1, col2 = st.columns(2)
                    with col1:
                        st.write("**Desempenho:**")
                        if c['mat_adicao'] is not None:
                            st.write(f"- Matemática: Adição({c['mat_adicao']}), Subtração({c['mat_subtracao']}), Multiplicação({c['mat_multiplicacao']}), Divisão({c['mat_divisao']})")
                        if c['port_leitura'] is not None:
                            st.write(f"- Português: Leitura({c['port_leitura']}), Escrita({c['port_escrita']}), Interpretação({c['port_interpretacao']})")
                    
                    with col2:
                        st.write("**Situação:**")
                        st.write(f"Parecer: {c['parecer_evolutivo']}")
                        if c['observacao_geral']:
                            st.markdown(f"*Obs: {c['observacao_geral']}*")
