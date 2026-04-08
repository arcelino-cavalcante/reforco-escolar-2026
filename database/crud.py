from database.connection import get_db
import datetime

# ==========================================
# HELPERS
# ==========================================
def _doc_to_dict(doc):
    if not doc.exists: return None
    d = doc.to_dict()
    d['id'] = doc.id
    return d

def _docs_to_list(docs):
    return [_doc_to_dict(doc) for doc in docs]

# ==========================================
# ETAPAS
# ==========================================
def listar_etapas():
    db = get_db()
    return _docs_to_list(db.collection('etapas').get())

# ==========================================
# TURMAS
# ==========================================
def criar_turma(nome, etapa_id):
    db = get_db()
    ref = db.collection('turmas').document()
    ref.set({'nome': nome, 'etapa_id': str(etapa_id)})
    return ref.id

def atualizar_turma(id, nome, etapa_id):
    db = get_db()
    db.collection('turmas').document(str(id)).update({'nome': nome, 'etapa_id': str(etapa_id)})
    return 1

def listar_turmas(etapa_id=None):
    db = get_db()
    etapas_map = {e.id: e.to_dict().get('nome', '') for e in db.collection('etapas').get()}
    query = db.collection('turmas')
    if etapa_id: query = query.where('etapa_id', '==', str(etapa_id))
    turmas = _docs_to_list(query.get())
    for t in turmas:
        eid = t.get('etapa_id')
        t['etapa_nome'] = etapas_map.get(eid, '')
    return sorted(turmas, key=lambda x: x.get('nome', ''))

def excluir_turma(id):
    db = get_db()
    db.collection('turmas').document(str(id)).delete()
    return 1

# ==========================================
# ESTUDANTES
# ==========================================
def criar_estudante(nome, turma_id):
    db = get_db()
    ref = db.collection('estudantes').document()
    ref.set({'nome': nome, 'turma_id': str(turma_id), 'ativo': 1})
    return ref.id

def atualizar_estudante(id, nome, turma_id):
    db = get_db()
    db.collection('estudantes').document(str(id)).update({'nome': nome, 'turma_id': str(turma_id)})
    return 1

def listar_estudantes(turma_id=None):
    db = get_db()
    turmas_dict = {t['id']: t for t in listar_turmas()}
    query = db.collection('estudantes')
    if turma_id: query = query.where('turma_id', '==', str(turma_id))
    estudos = _docs_to_list(query.get())
    res = []
    for est in estudos:
        t_id = est.get('turma_id')
        t_info = turmas_dict.get(t_id, {})
        est['turma_nome'] = t_info.get('nome', '')
        est['etapa_nome'] = t_info.get('etapa_nome', '')
        res.append(est)
    return sorted(res, key=lambda x: x.get('nome', ''))

def excluir_estudante(id):
    db = get_db()
    db.collection('estudantes').document(str(id)).delete()
    return 1

# ==========================================
# PROFESSORES REFORÇO
# ==========================================
def criar_prof_reforco(nome, area, turmas_ids):
    db = get_db()
    ref = db.collection('professores_reforco').document()
    ref.set({'nome': nome, 'area': area, 'turmas_ids': [str(x) for x in turmas_ids]})
    return ref.id

def atualizar_prof_reforco(prof_id, nome, area, turmas_ids):
    db = get_db()
    db.collection('professores_reforco').document(str(prof_id)).update({
        'nome': nome, 'area': area, 'turmas_ids': [str(x) for x in turmas_ids]
    })
    return 1

def listar_profs_reforco():
    db = get_db()
    return sorted(_docs_to_list(db.collection('professores_reforco').get()), key=lambda x: x.get('nome', ''))

def obter_turmas_prof_reforco(prof_id):
    db = get_db()
    doc = db.collection('professores_reforco').document(str(prof_id)).get()
    return doc.to_dict().get('turmas_ids', []) if doc.exists else []

def excluir_prof_reforco(id):
    db = get_db()
    db.collection('professores_reforco').document(str(id)).delete()
    return 1

# ==========================================
# PROFESSORES REGENTES
# ==========================================
def criar_prof_regente(nome, area, turmas_ids):
    db = get_db()
    ref = db.collection('professores_regentes').document()
    ref.set({'nome': nome, 'area': area, 'turmas_ids': [str(x) for x in turmas_ids]})
    return ref.id

def atualizar_prof_regente(prof_id, nome, area, turmas_ids):
    db = get_db()
    db.collection('professores_regentes').document(str(prof_id)).update({
        'nome': nome, 'area': area, 'turmas_ids': [str(x) for x in turmas_ids]
    })
    return 1

def listar_profs_regentes():
    db = get_db()
    return sorted(_docs_to_list(db.collection('professores_regentes').get()), key=lambda x: x.get('nome', ''))

def obter_turmas_prof_regente(prof_id):
    db = get_db()
    doc = db.collection('professores_regentes').document(str(prof_id)).get()
    return doc.to_dict().get('turmas_ids', []) if doc.exists else []

def excluir_prof_regente(id):
    db = get_db()
    db.collection('professores_regentes').document(str(id)).delete()
    return 1

# ==========================================
# REGISTROS DIÁRIOS
# ==========================================
def obter_regente_por_turma_e_area(turma_id, area_disciplina):
    db = get_db()
    query = db.collection('professores_regentes').where('area', '==', area_disciplina).get()
    for doc in query:
        d = _doc_to_dict(doc)
        if str(turma_id) in d.get('turmas_ids', []):
            return d
    return None

def criar_registro_diario(estudante_id, prof_id, data_registro, bimestre, prof_regente_id, compareceu, motivo_falta, origem_conteudo, habilidade_trabalhada, nivel_compreensao="Não Avaliado", participacao=None, observacao=None, dificuldade_latente=None):
    db = get_db()
    ref = db.collection('registros_diarios').document()
    ref.set({
        'estudante_id': str(estudante_id), 'prof_id': str(prof_id),
        'data_registro': data_registro, 'bimestre': bimestre,
        'prof_regente_id': str(prof_regente_id) if prof_regente_id else None,
        'compareceu': compareceu, 'motivo_falta': motivo_falta,
        'origem_conteudo': origem_conteudo, 'habilidade_trabalhada': habilidade_trabalhada,
        'nivel_compreensao': nivel_compreensao, 'participacao': participacao, 'observacao': observacao,
        'dificuldade_latente': dificuldade_latente
    })
    return ref.id

def atualizar_registro_diario(id_reg, compareceu, motivo_falta, origem_conteudo, habilidade_trabalhada, nivel_compreensao="Não Avaliado", participacao=None, observacao=None, dificuldade_latente=None):
    db = get_db()
    db.collection('registros_diarios').document(str(id_reg)).update({
        'compareceu': compareceu, 'motivo_falta': motivo_falta,
        'origem_conteudo': origem_conteudo, 'habilidade_trabalhada': habilidade_trabalhada,
        'nivel_compreensao': nivel_compreensao, 'participacao': participacao, 'observacao': observacao,
        'dificuldade_latente': dificuldade_latente
    })
    return 1

def _build_registros_diarios(regs):
    estudantes_map = {e['id']: e for e in listar_estudantes()}
    profs_reforco_map = {p['id']: p for p in listar_profs_reforco()}
    for r in regs:
        est = estudantes_map.get(r.get('estudante_id'), {})
        r['estudante_nome'] = est.get('nome', '')
        r['turma_id'] = est.get('turma_id', '')
        r['turma_nome'] = est.get('turma_nome', '')
        r['etapa_nome'] = est.get('etapa_nome', '')
        pref = profs_reforco_map.get(r.get('prof_id'), {})
        r['prof_reforco_nome'] = pref.get('nome', '')
        r['prof_reforco_area'] = pref.get('area', '')
        r['prof_nome'] = pref.get('nome', '')
        r['prof_area'] = pref.get('area', '')
    return regs

def listar_registros_diarios(data_registro, prof_id):
    db = get_db()
    docs = db.collection('registros_diarios') \
        .where('data_registro', '==', data_registro) \
        .where('prof_id', '==', str(prof_id)).get()
    regs = _docs_to_list(docs)
    return sorted(_build_registros_diarios(regs), key=lambda x: x['id'], reverse=True)

def listar_registros_por_regente(prof_regente_id, bimestre_filtro=None):
    db = get_db()
    q = db.collection('registros_diarios').where('prof_regente_id', '==', str(prof_regente_id))
    if bimestre_filtro and bimestre_filtro != "Todos":
        q = q.where('bimestre', '==', bimestre_filtro)
    regs = _build_registros_diarios(_docs_to_list(q.get()))
    return sorted(regs, key=lambda x: x.get('data_registro', ''), reverse=True)

def obter_media_diaria_estudante_bimestre(estudante_id, prof_id, bimestre):
    db = get_db()
    q = db.collection('registros_diarios') \
        .where('estudante_id', '==', str(estudante_id)) \
        .where('prof_id', '==', str(prof_id)) \
        .where('bimestre', '==', bimestre).get()
    soma = 0
    cnt = 0
    # Modificado para se adequar a Strings de avaliacao qualitativa no legadinho se tiver int
    # Caso tenham sido salvas string, daremos fallback pq não há como somar "Autonomo".
    # Retornarei Null (None) se a nova escala predominou 
    for doc in q:
        d = doc.to_dict()
        if d.get('compareceu') == 1:
            val = d.get('nivel_compreensao', 0)
            if isinstance(val, (int, float)):
                soma += float(val)
                cnt += 1
    return round(soma/cnt) if cnt>0 else None

def contar_presencas_estudante(estudante_id, prof_id):
    db = get_db()
    q = db.collection('registros_diarios') \
        .where('estudante_id', '==', str(estudante_id)) \
        .where('prof_id', '==', str(prof_id)).get()
    return sum(1 for doc in q if doc.to_dict().get('compareceu') == 1)

# ==========================================
# CONSOLIDADOS MENSAIS
# ==========================================
def obter_consolidado_trimestre(estudante_id, prof_id, bimestre):
    db = get_db()
    q = db.collection('consolidados_mensais') \
        .where('estudante_id', '==', str(estudante_id)) \
        .where('prof_id', '==', str(prof_id)) \
        .where('bimestre', '==', bimestre).get()
    return _doc_to_dict(q[0]) if q else None

def criar_consolidado_mensal(estudante_id, prof_id, prof_regente_id, data_registro, bimestre, 
                             mat_adicao=None, mat_subtracao=None, mat_multiplicacao=None, mat_divisao=None, mat_resolucao=None,
                             port_escrita=None, port_leitura=None, port_interpretacao=None, port_pontuacao=None,
                             parecer_evolutivo=None, observacao_geral=None, recomendacao_alta=False, acao_pedagogica=None):
    db = get_db()
    ref = db.collection('consolidados_mensais').document()
    ref.set({
        'estudante_id': str(estudante_id), 'prof_id': str(prof_id), 'prof_regente_id': str(prof_regente_id) if prof_regente_id else None,
        'data_registro': data_registro, 'bimestre': bimestre,
        'mat_adicao': mat_adicao, 'mat_subtracao': mat_subtracao, 'mat_multiplicacao': mat_multiplicacao, 'mat_divisao': mat_divisao, 'mat_resolucao': mat_resolucao,
        'port_escrita': port_escrita, 'port_leitura': port_leitura, 'port_interpretacao': port_interpretacao, 'port_pontuacao': port_pontuacao,
        'parecer_evolutivo': parecer_evolutivo, 'observacao_geral': observacao_geral,
        'recomendacao_alta': recomendacao_alta, 'acao_pedagogica': acao_pedagogica
    })
    return ref.id

def atualizar_consolidado_mensal(id_resumo, data_registro,
                                 mat_adicao=None, mat_subtracao=None, mat_multiplicacao=None, mat_divisao=None, mat_resolucao=None,
                                 port_escrita=None, port_leitura=None, port_interpretacao=None, port_pontuacao=None,
                                 parecer_evolutivo=None, observacao_geral=None, recomendacao_alta=False, acao_pedagogica=None):
    db = get_db()
    db.collection('consolidados_mensais').document(str(id_resumo)).update({
        'data_registro': data_registro,
        'mat_adicao': mat_adicao, 'mat_subtracao': mat_subtracao, 'mat_multiplicacao': mat_multiplicacao, 'mat_divisao': mat_divisao, 'mat_resolucao': mat_resolucao,
        'port_escrita': port_escrita, 'port_leitura': port_leitura, 'port_interpretacao': port_interpretacao, 'port_pontuacao': port_pontuacao,
        'parecer_evolutivo': parecer_evolutivo, 'observacao_geral': observacao_geral,
        'recomendacao_alta': recomendacao_alta, 'acao_pedagogica': acao_pedagogica
    })
    return 1

# ==========================================
# GESTÃO COORDENAÇÃO
# ==========================================
def obter_estatisticas_coordenacao(mes, ano):
    db = get_db()
    stats = {}
    stats['qtd_prof_reforco'] = len(_docs_to_list(db.collection('professores_reforco').get()))
    stats['qtd_prof_regente'] = len(_docs_to_list(db.collection('professores_regentes').get()))
    
    data_prefix = f"{ano:04d}-{mes:02d}-"
    regs = _docs_to_list(db.collection('registros_diarios').get())
    stats['qtd_registros_mes'] = sum(1 for r in regs if r.get('data_registro','').startswith(data_prefix))
    
    estudantes = _docs_to_list(db.collection('estudantes').get())
    stats['qtd_total_estudantes'] = len(estudantes)
    
    turmas = {t['id']: t for t in listar_turmas()}
    etapas_count = {}
    for e in estudantes:
        tid = e.get('turma_id')
        tinfo = turmas.get(tid, {})
        enome = tinfo.get('etapa_nome', 'Sem Etapa')
        etapas_count[enome] = etapas_count.get(enome, 0) + 1
        
    stats['estudantes_por_etapa'] = [{'etapa_nome': k, 'contagem': v} for k, v in etapas_count.items()]
    return stats

def obter_estatisticas_reforco(prof_id):
    db = get_db()
    stats = {}
    
    t_ids = obter_turmas_prof_reforco(prof_id)
    estudantes = _docs_to_list(db.collection('estudantes').get())
    stats['qtd_total_estudantes'] = sum(1 for e in estudantes if e.get('turma_id') in t_ids)
    
    hoje = datetime.date.today()
    uma_sem = hoje - datetime.timedelta(days=7)
    q = db.collection('registros_diarios').where('prof_id','==',str(prof_id)).where('data_registro','>=',uma_sem.isoformat()).get()
    
    atendidos = set()
    for doc in q:
        d = doc.to_dict()
        if d.get('compareceu') == 1:
            atendidos.add(d.get('estudante_id'))
    stats['qtd_atendidos_semana'] = len(atendidos)
    return stats

def listar_todos_registros_mes(mes, ano):
    db = get_db()
    data_prefix = f"{ano:04d}-{mes:02d}-"
    regs = _docs_to_list(db.collection('registros_diarios').get())
    regs = [r for r in regs if r.get('data_registro','').startswith(data_prefix)]
    return sorted(_build_registros_diarios(regs), key=lambda x: x.get('data_registro',''), reverse=True)

def listar_todos_registros_diarios():
    db = get_db()
    regs = _docs_to_list(db.collection('registros_diarios').get())
    return sorted(_build_registros_diarios(regs), key=lambda x: x.get('data_registro',''), reverse=True)

def listar_todos_registros_diarios_ultimos_dias(dias=30):
    db = get_db()
    import datetime
    t_limit = (datetime.date.today() - datetime.timedelta(days=dias)).isoformat()
    q = db.collection('registros_diarios').where('data_registro', '>=', t_limit).get()
    regs = _docs_to_list(q)
    return sorted(_build_registros_diarios(regs), key=lambda x: x.get('data_registro',''), reverse=True)

# ==========================================
# ENCAMINHAMENTOS
# ==========================================
def criar_encaminhamento(estudante_id, regente_id, alvo_area, habilidade_foco, observacao, data_solicitacao):
    db = get_db()
    ref = db.collection('encaminhamentos').document()
    ref.set({
        'estudante_id': str(estudante_id), 'regente_id': str(regente_id),
        'alvo_area': alvo_area, 'habilidade_foco': habilidade_foco,
        'observacao': observacao, 'data_solicitacao': data_solicitacao,
        'status': 'PENDENTE'
    })
    return ref.id

def obter_encaminhamentos_pendentes(estudante_id, area_prof):
    db = get_db()
    q = db.collection('encaminhamentos') \
        .where('estudante_id', '==', str(estudante_id)) \
        .where('alvo_area', '==', area_prof) \
        .where('status', '==', 'PENDENTE').get()
    
    regs = _docs_to_list(q)
    regentes_map = {r['id']: r for r in listar_profs_regentes()}
    for r in regs:
        reg_id = r.get('regente_id')
        r['regente_nome'] = regentes_map.get(reg_id, {}).get('nome', '')
    
    return sorted(regs, key=lambda x: x.get('data_solicitacao',''))

def concluir_encaminhamento(encaminhamento_id, resposta=None):
    db = get_db()
    update_data = {'status': 'ATENDIDO_PELO_REFORCO'}
    if resposta: update_data['resposta_reforco'] = resposta
    db.collection('encaminhamentos').document(str(encaminhamento_id)).update(update_data)
    return 1

def marcar_encaminhamento_lido_regente(encaminhamento_id):
    db = get_db()
    db.collection('encaminhamentos').document(str(encaminhamento_id)).update({'status': 'LIDO_PELO_REGENTE'})
    return 1

def listar_encaminhamentos_enviados_estudante(estudante_id, regente_id):
    db = get_db()
    q = db.collection('encaminhamentos') \
        .where('estudante_id', '==', str(estudante_id)) \
        .where('regente_id', '==', str(regente_id)).get()
    return sorted(_docs_to_list(q), key=lambda x: x.get('data_solicitacao',''), reverse=True)

def listar_registros_diarios_trinta_dias(prof_id, turma_id):
    db = get_db()
    import datetime
    t_30 = (datetime.date.today() - datetime.timedelta(days=30)).isoformat()
    q = db.collection('registros_diarios').where('prof_id', '==', str(prof_id)).where('data_registro','>=', t_30).get()
    regs = _docs_to_list(q)
    target_estudantes = [e['id'] for e in listar_estudantes(str(turma_id))]
    regs = [r for r in regs if r.get('estudante_id') in target_estudantes]
    return sorted(_build_registros_diarios(regs), key=lambda x: x.get('data_registro',''), reverse=True)

def listar_consolidados_por_prof_reforco(prof_id):
    db = get_db()
    q = db.collection('consolidados_mensais').where('prof_id', '==', str(prof_id)).get()
    regs = _docs_to_list(q)
    estudantes_map = {e['id']: e for e in listar_estudantes()}
    for r in regs:
        est = estudantes_map.get(r.get('estudante_id'), {})
        r['estudante_nome'] = est.get('nome', '')
        r['turma_nome'] = est.get('turma_nome', '')
    return sorted(regs, key=lambda x: x.get('data_registro',''), reverse=True)

def listar_consolidados_por_regente(prof_regente_id, bimestre="Todos"):
    db = get_db()
    query = db.collection('consolidados_mensais').where('prof_regente_id', '==', str(prof_regente_id))
    if bimestre != "Todos":
        query = query.where('bimestre', '==', bimestre)
        
    regs = _docs_to_list(query.get())
    
    # Anexar nome do professor de reforço
    profs = {p['id']: p for p in _docs_to_list(db.collection('professores').where('tipo', '==', 'Reforço').get())}
    for r in regs:
        r['prof_reforco_nome'] = profs.get(r.get('prof_id'), {}).get('nome', 'Equipe de Reforço')
        
    return sorted(regs, key=lambda x: x.get('data_registro',''), reverse=True)

def listar_registros_por_estudante(estudante_id):
    db = get_db()
    q = db.collection('registros_diarios').where('estudante_id', '==', str(estudante_id)).get()
    return sorted(_build_registros_diarios(_docs_to_list(q)), key=lambda x: x.get('data_registro',''), reverse=True)

def listar_consolidados_por_estudante(estudante_id):
    db = get_db()
    q = db.collection('consolidados_mensais').where('estudante_id', '==', str(estudante_id)).get()
    regs = _docs_to_list(q)
    # inject teacher info
    profs = {p['id']: p for p in _docs_to_list(db.collection('professores').where('tipo', '==', 'Reforço').get())}
    for r in regs:
        r['prof_reforco_nome'] = profs.get(r.get('prof_id'), {}).get('nome', 'Equipe de Reforço')
    return sorted(regs, key=lambda x: x.get('data_registro',''), reverse=True)

# ==========================================
# CÉREBRO DA IA (CONFIGURAÇÃO)
# ==========================================
def obter_contexto_ia():
    db = get_db()
    doc = db.collection('configuracoes').document('ia_contexto_personalizado').get()
    return doc.to_dict().get('diretrizes', '') if doc.exists else ''

def salvar_contexto_ia(texto):
    db = get_db()
    db.collection('configuracoes').document('ia_contexto_personalizado').set({'diretrizes': texto})
    return 1
