import os
import json
import glob
import shutil
import subprocess
import threading
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

FRONTEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(FRONTEND_DIR)

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
CORS(app)

def _find_claude():
    found = shutil.which('claude') or shutil.which('claude.cmd')
    if found:
        return found
    npm_path = os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'npm', 'claude.cmd')
    if os.path.exists(npm_path):
        return npm_path
    return 'claude'

CLAUDE_BIN   = _find_claude()
CLAUDE_MODEL = 'claude-sonnet-4-5'

running_agents = {}
agent_logs     = {}

AGENT_OUTPUT_FILES = {
    'researcher': 'topics.json',
    'ideator':    'angles.json',
    'scripter':   'scripts.json',
    'analyst':    None,
}


def _get_output_dir():
    pattern = os.path.join(PROJECT_ROOT, 'outputs', 'busca_*')
    folders = sorted(glob.glob(pattern), reverse=True)
    if folders:
        return folders[0]
    date_str = datetime.now().strftime('%d_%m_%Y')
    new_dir = os.path.join(PROJECT_ROOT, 'outputs', f'busca_{date_str}')
    os.makedirs(new_dir, exist_ok=True)
    return new_dir


def _get_agent_file(agent_name, output_dir):
    if agent_name == 'analyst':
        pattern = os.path.join(output_dir, 'relatorio_semana_*.md')
        files = sorted(glob.glob(pattern), reverse=True)
        return files[0] if files else None
    filename = AGENT_OUTPUT_FILES.get(agent_name)
    return os.path.join(output_dir, filename) if filename else None


@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/api/status')
def get_status():
    output_dir = _get_output_dir()
    result = {}
    for agent in ['researcher', 'ideator', 'scripter', 'analyst']:
        file_path = _get_agent_file(agent, output_dir)
        status = 'missing'
        last_run = None
        if file_path and os.path.exists(file_path):
            status = 'ok'
            mtime = os.path.getmtime(file_path)
            last_run = datetime.fromtimestamp(mtime).isoformat()
        if running_agents.get(agent):
            status = 'running'
        result[agent] = {
            'status': status,
            'last_run': last_run,
            'file': file_path,
            'is_running': running_agents.get(agent, False),
        }
    return jsonify(result)


@app.route('/api/current-cycle')
def current_cycle():
    output_dir = _get_output_dir()
    folder_name = os.path.basename(output_dir)
    return jsonify({
        'output_dir': output_dir,
        'folder_name': folder_name,
        'date': folder_name.replace('busca_', ''),
    })


def _run_agent_thread(agent_name, output_dir, metrics_text=None):
    running_agents[agent_name] = True
    agent_logs[agent_name] = []

    def log(msg):
        ts = datetime.now().strftime('%H:%M:%S')
        agent_logs[agent_name].append(f'[{ts}] {msg}')

    try:
        agent_md = os.path.join(PROJECT_ROOT, 'agents', f'{agent_name}.md')
        with open(agent_md, 'r', encoding='utf-8') as f:
            base_prompt = f.read()

        date_str = datetime.now().strftime('%d_%m_%Y')

        OVERWRITE = '\n\nIMPORTANTE: Sobrescreva o arquivo de output sem pedir confirmação. Execute a tarefa completa e salve diretamente.'

        if agent_name == 'researcher':
            full_prompt = (
                f"{base_prompt}{OVERWRITE}\n\n"
                f"Salve o resultado em: {output_dir}/topics.json"
            )

        elif agent_name == 'ideator':
            topics_path = os.path.join(output_dir, 'topics.json')
            extra = ''
            if os.path.exists(topics_path):
                with open(topics_path, 'r', encoding='utf-8') as f:
                    extra = f'\n\nConteúdo atual de topics.json:\n{f.read()}'
            full_prompt = (
                f"{base_prompt}{extra}{OVERWRITE}\n\n"
                f"Salve o resultado em: {output_dir}/angles.json"
            )

        elif agent_name == 'scripter':
            angles_path = os.path.join(output_dir, 'angles.json')
            extra = ''
            if os.path.exists(angles_path):
                with open(angles_path, 'r', encoding='utf-8') as f:
                    angles_data = json.load(f)
                # Seleciona apenas top 5 ângulos de potencial alto
                todos = angles_data.get('angulos', [])
                top = [a for a in todos if a.get('potencial_estimado') == 'alto'][:5]
                if not top:
                    top = todos[:5]
                filtrado = {**angles_data, 'angulos': top}
                extra = (
                    f'\n\nÂngulos selecionados para roteiro (top 5 alto potencial):\n'
                    f'{json.dumps(filtrado, ensure_ascii=False, indent=2)}'
                )
            full_prompt = (
                f"{base_prompt}{extra}{OVERWRITE}\n\n"
                f"Gere roteiros APENAS para os {len(top) if top else 5} ângulos fornecidos acima.\n"
                f"Salve o resultado em: {output_dir}/scripts.json"
            )

        elif agent_name == 'analyst':
            report_file = f'relatorio_semana_{date_str}.md'
            metrics_section = (
                f'\n\nMétricas da semana:\n{metrics_text}' if metrics_text else ''
            )
            full_prompt = (
                f"{base_prompt}{metrics_section}{OVERWRITE}\n\n"
                f"Salve o relatório em: {output_dir}/{report_file}"
            )

        log(f'Iniciando {agent_name}...')
        log(f'Pasta de output: {os.path.basename(output_dir)}')

        result = subprocess.run(
            [CLAUDE_BIN, '-p', '--dangerously-skip-permissions', '--model', CLAUDE_MODEL],
            input=full_prompt,
            capture_output=True,
            text=True,
            encoding='utf-8',
            cwd=PROJECT_ROOT,
            timeout=1800,
        )

        if result.stdout:
            for line in result.stdout.splitlines():
                agent_logs[agent_name].append(line)
        if result.stderr:
            for line in result.stderr.splitlines():
                agent_logs[agent_name].append(f'[stderr] {line}')

        if result.returncode == 0:
            log(f'✓ {agent_name} concluído com sucesso')
        else:
            log(f'✗ Erro: código de saída {result.returncode}')

    except subprocess.TimeoutExpired:
        log('✗ Timeout: agente excedeu 30 minutos')
    except FileNotFoundError:
        log('✗ Erro: comando "claude" não encontrado no PATH.')
    except Exception as e:
        log(f'✗ Erro inesperado: {str(e)}')
    finally:
        running_agents[agent_name] = False


@app.route('/api/run/<agent_name>', methods=['POST'])
def run_agent(agent_name):
    if agent_name not in ['researcher', 'ideator', 'scripter', 'analyst']:
        return jsonify({'success': False, 'error': 'Agente inválido'}), 400
    if running_agents.get(agent_name):
        return jsonify({'success': False, 'error': 'Agente já está executando'}), 409

    output_dir   = _get_output_dir()
    data         = request.get_json() or {}
    metrics_text = data.get('metrics')

    t = threading.Thread(
        target=_run_agent_thread,
        args=(agent_name, output_dir, metrics_text),
        daemon=True,
    )
    t.start()

    return jsonify({'success': True, 'output_dir': output_dir, 'message': f'{agent_name} iniciado'})


@app.route('/api/logs/<agent_name>')
def get_logs(agent_name):
    return jsonify({
        'logs': agent_logs.get(agent_name, []),
        'is_running': running_agents.get(agent_name, False),
    })


@app.route('/api/data/topics')
def get_topics():
    output_dir = _get_output_dir()
    path = os.path.join(output_dir, 'topics.json')
    if not os.path.exists(path):
        return jsonify({'error': 'topics.json não encontrado', 'topicos': []}), 404
    with open(path, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))


@app.route('/api/data/angles')
def get_angles():
    output_dir = _get_output_dir()
    path = os.path.join(output_dir, 'angles.json')
    if not os.path.exists(path):
        return jsonify({'error': 'angles.json não encontrado', 'angulos': []}), 404
    with open(path, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))


@app.route('/api/data/scripts')
def get_scripts():
    output_dir = _get_output_dir()
    path = os.path.join(output_dir, 'scripts.json')
    if not os.path.exists(path):
        return jsonify({'error': 'scripts.json não encontrado', 'roteiros': []}), 404
    with open(path, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))


@app.route('/api/data/report')
def get_report():
    output_dir = _get_output_dir()
    pattern = os.path.join(output_dir, 'relatorio_semana_*.md')
    files = sorted(glob.glob(pattern), reverse=True)
    if not files:
        return jsonify({'error': 'Nenhum relatório encontrado', 'content': ''}), 404
    with open(files[0], 'r', encoding='utf-8') as f:
        return jsonify({'content': f.read(), 'file': os.path.basename(files[0])})


if __name__ == '__main__':
    os.chdir(PROJECT_ROOT)
    print(f'\n  Pipeline de Marketing — Dashboard')
    print(f'  Modelo: {CLAUDE_MODEL}')
    print(f'  Servidor: http://localhost:5050')
    print(f'  Projeto:  {PROJECT_ROOT}\n')
    app.run(host='0.0.0.0', port=5050, debug=False)
