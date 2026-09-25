// ==UserScript==
// @name            ASCbyBitts!
// @author          Bitts
// @copyright       2021, Marcelo Valvassori Bittencourt (https://github.com/bitts/)
// @description     Adição de funcionalidades que tornam o site mais moderno, dinâmico e fluído.
// @namespace       https://github.com/bitts/asc
// @homepage        https://mbitts.com
// @homepageURL     https://mbitts.com
// @supportURL      https://openuserjs.org/scripts/marcelo.valvassori/Amigos-Share_Tanks/issues
// @support         https://openuserjs.org/scripts/marcelo.valvassori/Amigos-Share_Tanks/issues
// @updateURL       https://openuserjs.org/install/marcelo.valvassori/Amigos-Share_Tanks.user.js
// @downloadURL     https://openuserjs.org/install/marcelo.valvassori/Amigos-Share_Tanks.user.js
// @icon            https://cliente.amigos-share.club/favicon.ico
// @iconURL         https://cliente.amigos-share.club/favicon.ico
// @include         https://cliente.amigos-share.club/*
// @run-at          document-start
// @version         4.0.0
// @license      	MIT; https://opensource.org/licenses/MIT
// @noframes
// @tag             Torrent
// @tag             Productivity
// @tag             Community
// @grant           GM_xmlhttpRequest
// @grant           GM_notification
// @grant           GM_getValue
// @grant           GM_setValue
// @connect         openuserjs.org

// ==/UserScript==

// =====================================================
// CORE
// =====================================================

/**
 * Escapa texto para uso seguro dentro de innerHTML.
 * Usado em qualquer trecho que interpole texto vindo do site (títulos de
 * torrents, nomes de arquivo etc.) — conteúdo de uma comunidade multi-usuário
 * não deve ser inserido "cru" em innerHTML, sob risco de XSS caso um título
 * contenha marcação HTML.
 */
function escapeHTML(texto) {
    if (texto === null || texto === undefined)return '';
    return String(texto).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

/**
 * Localiza o card "Comentários" (fórum e torrents-details.php usam exatamente a
 * mesma marcação: <div class="card"><h5 class="card-header">Comentários</h5>
 * <div class="card-body">...linhas .row, uma por comentário...</div></div>).
 * Busca pelo texto do h5 em vez de depender de uma posição fixa (nth-child),
 * já que essa posição muda bastante entre um tópico de fórum e a página de um
 * torrent (que tem várias outras cards antes: informações, agradecimentos etc.).
 * @param {Document|Element} root
 * @returns {Element|null} o .card-body do card de comentários, ou null
 */
function encontrarCardBodyComentarios(root = document) {
    const h5 = [...root.querySelectorAll('h5.card-header')].find(h => h.textContent.trim() === 'Comentários');
    return h5?.closest('.card')?.querySelector('.card-body') ?? null;
}

class ASCStorage {
    constructor() {
        this.KEY_BACKUP = 'ASC_BACKUP';
    }
    //Cookies
    getCookie(nome) {
        const valor = document.cookie.split('; ').find(row => row.startsWith(nome + '='));
        return valor ? decodeURIComponent(valor.split('=')[1]) : null;
    }
    setCookie(nome, valor, dias = 365) {
        const data = new Date();
        data.setTime( data.getTime() + (dias * 24 * 60 * 60 * 1000) );
        document.cookie = `${nome}=${encodeURIComponent(valor)};expires=${data.toUTCString()};path=/`;
    }
    //localStorage
    lerLocalStorage() {
        try {
            return JSON.parse( localStorage.getItem(this.KEY_BACKUP) || '{}');
        } catch(e) {
            return {};
        }
    }
    lerGMStorage() {
        try {
            if (typeof GM_getValue !== 'function')return {};
            return JSON.parse(GM_getValue( this.KEY_BACKUP, '{}' ));
        } catch(e) {
            return {};
        }
    }
    lerCookies() {
        try {
            const valor = this.getCookie(this.KEY_BACKUP);
            return valor ? JSON.parse(valor) : {};
        } catch(e) {
            return {};
        }
    }
    //Método principal de recuperação dos dados
    getDownloadsConsolidados() {
        const memoria = window.ASC_CACHE_DOWNLOADS || {};
        const local = this.lerLocalStorage();
        const cookies = this.lerCookies();
        const gm = this.lerGMStorage();
        const resultado = {};
        [ memoria, local, cookies, gm ].forEach(origem => {
            Object.entries(origem).forEach(([id,dado]) => {
                if ( !resultado[id] ) {
                    resultado[id] = dado;
                    return;
                }
                const atual = resultado[id];
                const dataAtual = atual.updatedAt || 0;
                const dataNova = dado.updatedAt || 0;
                if ( dataNova > dataAtual ) resultado[id] = dado;
            });
        });
        return resultado;
    }
    sincronizarStorages() {
        const dados = this.getDownloadsConsolidados();
        localStorage.setItem( this.KEY_BACKUP, JSON.stringify(dados) );
        this.setCookie( this.KEY_BACKUP, JSON.stringify(dados) );
        if ( typeof GM_setValue === 'function' ) GM_setValue( this.KEY_BACKUP, JSON.stringify(dados) );
        window.ASC_CACHE_DOWNLOADS = dados;
        return dados;
    }
    salvarTorrent(torrent) {
        const dados = this.getDownloadsConsolidados();
        dados[torrent.id] = { ...torrent, updatedAt: Date.now() };
        localStorage.setItem( this.KEY_BACKUP, JSON.stringify(dados) );
        this.setCookie( this.KEY_BACKUP, JSON.stringify(dados) );
        if ( typeof GM_setValue === 'function' ) GM_setValue( this.KEY_BACKUP, JSON.stringify(dados) );
        window.ASC_CACHE_DOWNLOADS = dados;
    }
    validarBase() {
        const dados = this.getDownloadsConsolidados();
        let corrigidos = 0;
        Object.entries(dados).forEach(([id,item]) => {
            if (!item.id) {
                item.id = Number(id);
                corrigidos++;
            }
            if (item.agradeceu === undefined) {
                item.agradeceu = false;
                corrigidos++;
            }
        });
        if (corrigidos > 0)this.sincronizarStorages();
        return corrigidos;
    }
}

class ASCPlus {
    constructor() {
        if(location.pathname.includes('tanks.php')){
            const torrentId = new URLSearchParams(location.search).get('id');
            if(torrentId){
                const torrent = this.getTorrentCache(torrentId);
                if(torrent){
                    torrent.agradeceu = true;
                    torrent.ultimaVerificacao = Date.now();
                    this.setTorrentCache(torrentId, torrent)
                }
            }
        }
        this.setLog({ tipo: 'log', classe: 'ASCPlus', texto: `Iniciando busca de filmes não avaliados...`});
        this.storage = new ASCStorage();
        this.url = `https://cliente.amigos-share.club`;
        this.exportFileCSV = `ASCPLUS_BACKUP-${Date.now()}.csv`;
        this.exportFileJSON = `ASCPLUS_BACKUP-${Date.now()}.json`;
        this.about = {
            'uuid': 29618,
            'createin':'2021-06-29',
            'lastUpdate':'2026-08-01',
        };
        this.cache = {
            torrents: new Map(),
            agradecimentos: new Map()
        };
        this.cachePersistente = {};
        this.db = {
            version: GM_info.script.version,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            downloads: {
                ultimaSincronizacao: 0,
                totalPaginas: 0,
                torrents: []
            },
            torrents: {}
        };
        this.CONFIG = {
            DOWNLOADS_CACHE_DIAS : 30,
            TORRENT_CACHE_DIAS : 30,
            PROCESSAMENTO_LOTE : 25,
            ATRASO_REQUISICAO : 1000
        };
        this.CACHE_DIAS = 30;
        this.STORAGE_USER_ID = 'ASCPLUS_UUID';
        this.carregarBanco();
        this.initNavigatorDatabase();
    }
    /**
    * Verifica se um registro ainda é válido.
    */
    isCacheValido(timestamp, dias = 30) {
        if (!timestamp) return false;
        const limite = dias * 24 * 60 * 60 * 1000;
        return ( Date.now() - timestamp ) < limite;
    }
    getDownloadsCache() {
        if (!this.db.downloads) {
            this.db.downloads = {
                ultimaSincronizacao: 0,
                totalPaginas: 0,
                torrents: []
            };
        }
        return this.db.downloads;
    }
    setDownloadsCache(totalPaginas, torrents) {
        this.db.downloads = {
            ultimaSincronizacao: Date.now(),
            totalPaginas,
            torrents
        };
        this.salvarBanco();
    }
    /**
    * Verifica se o torrent deve ser consultado novamente.
    */
    precisaSincronizarTorrent(torrentId) {
        const torrent = this.getTorrentCache(torrentId);
        if (!torrent) return true;
        //Nunca agradeceu.
        if ( torrent.agradeceu === false )return true;
        //Cache expirado.
        if ( !this.isCacheValido( torrent.ultimaVerificacao, this.CONFIG.TORRENT_CACHE_DIAS ))return true;
        return false;
    }
    /**
    * Verifica a necessidade de atualiza os caches de dados salvos na seção do usuário
    */
    precisaSincronizarDownloads() {
        return !this.isCacheValido( this.db.downloads?.ultimaAtualizacao, this.CONFIG.DOWNLOADS_CACHE_DIAS );
    }
    /**
    * realizada a varredura dos
    */
    downloadsPrecisamAtualizar() {
        const cache = this.getDownloadsCache();
        if (!cache.torrents.length)return true;
        const UMA_HORA = 60 * 60 * 1000;
        const UM_DIA = 24 * 60 * 60 * 1000;
        return ( Date.now() - cache.ultimaSincronizacao ) > UM_DIA;
    }
    /**
    * Carrega banco persistido - dados salvos no sistema
    * @returns {Integer}
    */
    carregarBanco() {
        try {
            const dadosGM = GM_getValue( this.storage.KEY_BACKUP, null );
            if (dadosGM) {
                this.db = typeof dadosGM === 'string' ? JSON.parse(dadosGM) : dadosGM;
                this.setLog({ tipo: 'sucesso', classe: 'ASCPlus', texto: `Banco carregado do "GM_getValue" com ${Object.keys(this.db.torrents).length} registros`});
                return this.db;
            }
        } catch(e) {
            this.setLog({ tipo:'erro', classe: 'ASCPlus', texto:`Falha ao acessar dados do "GM_getValue": ${e.message}` });
        }
        try {
            const dadosLS = localStorage.getItem( this.storage.KEY_BACKUP );
            if (dadosLS) {
                this.db = JSON.parse(dadosLS);
                this.setLog({ tipo: 'sucesso', classe: 'ASCPlus', texto: `Banco carregado do "localStorage" com ${Object.keys(this.db.torrents).length} registros`});
                return this.db;
            }
        } catch(e) {
            this.setLog({ tipo:'erro', classe: 'ASCPlus', texto:`Falha ao acessar dados do "localStorage": ${e.message}` });
        }
        return this.db;
    }
    /**
    * Inicializa estrutura do Navigator
    */
    initNavigatorDatabase(){
        if(!this.db.navigator){
            // Config vem de ASCNavigatorConfig.DEFAULT para existir uma única fonte de
            // verdade (antes havia uma cópia divergente aqui e outra em ASCPageCache,
            // com chaves diferentes como "restorePages" vs "restoreLoadedPages").
            this.db.navigator = {
                config : structuredClone( ASCNavigatorConfig.DEFAULT ),
                cache : {},
                state : {}
            };
            this.salvarBanco();
        }
    }
    /**
    * Salva banco persistido - dados do sistema
    * @returns {Integer}
    */
    salvarBanco() {
        try {
            this.db.updatedAt = Date.now();
            GM_setValue( this.storage.KEY_BACKUP, JSON.stringify(this.db) );
        } catch(e) {
            this.setLog({ tipo: 'error', classe: 'ASCPlus', texto: `Erro ao salvar banco via "GM_setValue": ${e.message}`});
        }

        try {
            localStorage.setItem( this.storage.KEY_BACKUP, JSON.stringify(this.db) );
        } catch(e) {
            this.setLog({ tipo: 'error', classe: 'ASCPlus', texto: `Erro ao salvar banco via "localStorage": ${e.message}`});
        }
    }
    /**
    * Exporta dados salvos no formato JSON
    * @returns {JSON}
    */
    exportarBancoJSON() {
        const json = JSON.stringify(this.db, null, 4);
        const blob = new Blob([json],{ type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.exportFileJSON;
        a.click();
    }
    /**
    * Importar dados contidos em arquivo JSON para o sistema
    * @returns {Boolean}
    */
    async importarBancoJSON(arquivo) {
        try {
            const texto = await arquivo.text();
            const dados = JSON.parse(texto);
            this.db = dados;
            this.salvarBanco();
            this.setLog({ tipo: 'sucesso', classe: 'ASCPlus', texto: 'Backup importado' });
            return true;
        } catch (e) {
            this.setLog({ tipo: 'erro', classe: 'ASCPlus', texto: `Erro ao importar: ${e.message}`});
            return false;
        }
    }
    /**
    * Retorna o valor de um cookie pelo nome.
    *
    * @param {String} nome
    * @returns {String|null}
    */
    getCookie(nome) {
        try {
            const valor = document.cookie.split('; ').find(row => row.startsWith(`${nome}=`));
            if (!valor)return null;
            return decodeURIComponent(valor.split('=').slice(1).join('='));
        } catch (erro) {
            this.setLog({ tipo: 'erro', classe: 'ASCPlus', texto: `Erro ao ler cookie "${nome}": ${erro.message}`});
            return null;
        }
    }
    /**
    * Retorna o identificador do usuário no sistema
    * @returns {Integer}
    */
    getIDuser() {
        try {
            const seletores = [
                '.profile-name a[href*="account-details.php?id="]',
                '.navbar a[href*="account-details.php?id="]',
                '.nav-tabs a[href*="account-details.php?id="]',
                'a[href*="account-details.php?id="]'
            ];

            for (const seletor of seletores) {
                const links = document.querySelectorAll(seletor);
                for (const link of links) {
                    const href = link.getAttribute('href') || '';
                    const match = href.match(/account-details\.php\?id=(\d+)/i);
                    if (match) {
                        const id = Number(match[1]);
                        if (Number.isFinite(id)) {
                            this.setLog({ tipo: 'sucesso', classe: 'ASCPlus', texto: `ID encontrado: ${id}` });
                            try {
                                localStorage.setItem( this.STORAGE_USER_ID, String(id) );
                            } catch (e) {}
                            return id;
                        }
                    }
                }
            }
            throw new Error('Nenhum ID encontrado.');
        } catch (e) {
            this.setLog({ tipo: 'erro', classe: 'ASCPlus', texto: `Falha ao capturar ID do usuário através da raspagem dos dados do site: ${e.message}` });
        }

        try{
            const uidCookie = this.getCookie('uid');
            if (uidCookie) {
                const id = Number(uidCookie);
                if (Number.isFinite(id)) {
                    this.setLog({ tipo: 'sucesso', classe: 'ASCPlus', texto: `ID encontrado via cookie uid: ${id}`});
                    try {
                        localStorage.setItem( this.STORAGE_USER_ID, String(id) );
                    } catch (e) {}
                    return id;
                }
            }
        }catch(e){
            this.setLog({ tipo: 'erro', classe: 'ASCPlus', texto: `Falha ao capturar ID do usuário dos Cookies da página: ${e.message}` });
        }

        try {
            const idSalvo = localStorage.getItem( this.STORAGE_USER_ID );
            if (idSalvo) {
                const id = Number(idSalvo);
                if ( Number.isFinite(id) ) {
                    this.setLog({ tipo: 'sucesso', classe: 'ASCPlus', texto: `ID encontrado via localStorage: ${id}` });
                    return id;
                }
            }

        } catch (e) {}

        return NaN;
    }
    getTorrentCache(torrentId) {
        if (!this.db)return null;
        if (!this.db.torrents)return null;
        return this.db.torrents[String(torrentId)] || null;
    }
    setTorrentCache(torrentId, dados) {
        if ( !this.db.torrents )this.db.torrents = {};
        this.db.torrents[torrentId] = dados;
        this.salvarBanco();
    }
    async getPendentes() {
        return this.obterDados().pendentes;
    }
    /**
    * Exporta cache
    */
    exportarCache() {
        const dados = {
            system: GM_info.script.name,
            createby: GM_info.script.author,
            versao: this.db.version,
            banco: this.db,
            dataExportacao: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify( dados, null, 4 )], { type:'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.exportFileJSON;
        a.click();
    }
    /**
    * Importa cache
    */
    importarCache(json) {
        try {
            const dados = JSON.parse(json);
            if (!dados.banco) throw new Error('Formato inválido.');
            this.db = dados.banco;
            this.salvarBanco();
            this.setLog({'tipo': 'sucesso', classe: 'ASCPlus', 'texto': `Importação concluída.`});
            return true;
        } catch (erro) {
            this.setLog({'tipo': 'erro', classe: 'ASCPlus', 'texto': `Erro ao importar: ${erro.message || erro}`});
            return false;
        }
    }
    /**
    * Retorna o total de páginas da listagem de arquivos baixados
    * @returns {Promise<Object>}
    */
    async getTotalPages() {
        var page = 0, self = this, uId = this.getIDuser();

        if(Number.isNaN(uId))throw new Error(`Identificador de usuário invalido, não capturado ou não reconhecido!`);
        try {
            const response = await fetch(`${self.url}/account-details.php?action=baixados&id=${uId}&page=0`, { credentials: 'include' });
            if (!response.ok) throw new Error(`Status HTTP: ${response.status} - ${response.statusText}`);

            const htmlText = await response.text();
            self.setLog({'tipo': 'sucesso', classe: 'ASCPlus', 'texto': 'Consultando o total de itens baixados para mapear as páginas'});

            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            const linksPaginas = doc.querySelectorAll('.pagination a');

            linksPaginas.forEach(link => {
                let href = link.getAttribute('href') || '';
                let match = href.match(/page=(\d+)/);
                if (match) {
                    let numeroPagina = parseInt(match[1], 10);
                    if (numeroPagina > page)page = numeroPagina;
                }
            });
        } catch (erro) {
            self.setLog({'tipo': 'erro', classe: 'ASCPlus', 'texto': `Erro ao obter total de páginas: ${erro.message || erro}`});
            page = 0;
        }
        return parseInt(page, 10);
    }
    /**
    * Verifica o total de torrents baixados
    * @returns {Promise<Object>}
    */
    async getTotalDownload() {
        const CONCORRENCIA = 3;
        var self = this, pages, uId;

        if ( !this.precisaSincronizarDownloads() ) {
            this.setLog({ tipo : 'log', classe: 'ASCPlus', texto : 'Lista carregada do cache.'});
            return ( this.db.downloads.torrents || [] );
        }

        if (!this.downloadsPrecisamAtualizar()) {
            this.setLog({tipo: 'log', classe: 'ASCPlus', texto: 'Utilizando lista de downloads do cache.'});
            return this.db.downloads.torrents;
        }

        try {
            pages = await self.getTotalPages();
            pages = parseInt(pages, 10);
            if (Number.isNaN(pages)) pages = 0;
        } catch (e) {
            self.setLog({'tipo': 'erro', classe: 'ASCPlus', 'texto': `Falha crítica ao obter o total de páginas: ${e.message || e}`});
            return [];
        }

        try {
            uId = self.getIDuser();
        } catch (e) {
            self.setLog({'tipo': 'erro', classe: 'ASCPlus', 'texto': `Falha crítica ao ler o ID do usuário: ${e.message || e}`});
            return [];
        }

        if (Number.isNaN(uId) || uId === null || uId === undefined) {
            self.setLog({'tipo': 'erro', classe: 'ASCPlus', 'texto': `Ação abortada: Usuário não identificado na página (ID inválido).`});
            return [];
        }

        if (pages < 0) {
            self.setLog({'tipo': 'erro', classe: 'ASCPlus', 'texto': `Ação abortada: Quantidade de páginas inválida (${pages}).`});
            return [];
        }

        self.setLog({'tipo': 'log', classe: 'ASCPlus', 'texto': `Total de Páginas reconhecidas: ${pages}. Iniciando varredura...`});

        try {
            const paginas = Array.from({ length: pages + 1 }, (_, i) => i );
            const workerPagina = async (pagina) => {
                const response = await fetch(`${this.url}/account-details.php?action=baixados&id=${uId}&page=${pagina}`, { credentials: 'include' });
                const html = await response.text();
                return this.processarPagina( html, pagina );
            };
            const resultadosPorPagina = await this.executarComLimite( paginas, workerPagina, CONCORRENCIA );
            const resultadoFinal = resultadosPorPagina.flat();
            const unicos = [...new Map( resultadoFinal.map( item => [ item.id, item ] ) ).values()];

            self.setLog({'tipo': 'sucesso', classe: 'ASCPlus', 'texto': `Varredura completa concluída! Total de filmes coletados: ${resultadoFinal.length}`});
            this.setDownloadsCache( pages, unicos );
            this.db.downloads = { ultimaAtualizacao: Date.now(), torrents: unicos };
            this.salvarBanco();

            return unicos;
        } catch (e) {
            self.setLog({'tipo': 'erro', classe: 'ASCPlus', 'texto': `Erro crítico no fluxo paralelo de requisições: ${e.message || e}`});
            return [];
        }
    }
    precisaAtualizarRegistro(registro) {
        if (!registro) return true;
        const LIMITE = this.CACHE_DIAS * 24 * 60 * 60 * 1000;
        const ultima = registro.ultimaAtualizacao || registro.ultimaVerificacao || 0;

        return (Date.now() - ultima) > LIMITE;
    }
    async processarPendentes() {
        const pendentes = await this.getPendentes();
        for ( const torrent of pendentes )await this.verificarAgradecimento( torrent.id, this.getIDuser() );
    }
    processarPagina(html, pagina = 0) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const torrents = [];
            const idsEncontrados = new Set();
            const links = doc.querySelectorAll('a[href*="torrents-details.php?id="]');

            for (const link of links) {
                const href = link.getAttribute('href') || '';
                const match = href.match(/torrents-details\.php\?id=(\d+)/i);
                if (!match) continue;
                const id = Number(match[1]);
                if (idsEncontrados.has(id))continue;
                idsEncontrados.add(id);
                torrents.push({
                    id,
                    arquivo: (link.textContent || '').trim(),
                    pagina
                });
            }
            this.setLog({ tipo:'sucesso', classe: 'ASCPlus', texto:`Página ${pagina}: ${torrents.length} torrents encontrados` });
            return torrents;
        } catch (erro) {
            this.setLog({ tipo:'erro', classe: 'ASCPlus', texto:`Erro processando página ${pagina}: ${erro.message}` });
            return [];
        }
    }
    async verificarTodosDownloads(onProgress = null) {
        const userId = this.getIDuser();

        if (!userId)throw new Error('Usuário não identificado');

        const torrents = await this.getTotalDownload();
        const resultado = [];
        for (let i = 0; i < torrents.length; i++) {
            const torrent = torrents[i];
            try {
                if ( !this.precisaSincronizarTorrent(torrent.id) ) {
                    resultado.push( this.getTorrentCache(torrent.id) );
                    continue;
                }
                const status = await this.verificarAgradecimento( torrent.id, userId );
                const registro = {
                    ...torrent,
                    agradeceu: status.agradeceu,
                    totalAgradecimentos: status.totalAgradecimentos,
                    ultimaVerificacao: Date.now()
                };
                this.setTorrentCache( torrent.id, registro );
                resultado.push( registro );

                if(onProgress){
                    onProgress({
                        registro,
                        atual: i + 1,
                        total: torrents.length,
                        percentual: Math.round(( (i + 1) / torrents.length ) * 100 )
                    });
                }
            } catch (e) {
                this.setLog({ tipo : 'erro', classe: 'ASCPlus', texto : `Erro ao atualizar Torrent de ${torrent.id}: ${e.message}` });
            }
            await new Promise( r => setTimeout( r, this.CONFIG.ATRASO_REQUISICAO ) );
        }
        return resultado;
    }
    /**
     * Verifica se um usuário agradeceu um torrent.
     *
     * @param {number|string} torrentId
     * @param {number|string} userId
     * @returns {Promise<Object>}
     */
    async verificarAgradecimento(torrentId, userId) {
        const cacheKey = `${torrentId}_${userId}`;
        const cachePersistido = this.getTorrentCache(torrentId);

        if ( cachePersistido && !this.precisaAtualizarRegistro(cachePersistido) ) {
            return {
                torrentId: Number(torrentId),
                userId: Number(userId),
                agradeceu: cachePersistido.agradeceu,
                totalAgradecimentos: cachePersistido.totalAgradecimentos,
                usuarios: cachePersistido.usuarios
            };
        }

        if (this.cache && this.cache.agradecimentos && this.cache.agradecimentos.has(cacheKey) ) {
            return this.cache.agradecimentos.get(cacheKey);
        }

        const resultadoPadrao = {
            torrentId: Number(torrentId),
            userId: Number(userId),
            agradeceu: false,
            totalAgradecimentos: 0,
            usuarios: []
        };

        const cache = this.getTorrentCache(torrentId);
        if (cache) {
            return {
                torrentId: Number(torrentId),
                userId: Number(userId),
                agradeceu: cache.agradeceu,
                totalAgradecimentos: cache.totalAgradecimentos,
                usuarios: cache.usuarios || []
            };
        }

        try {
            const html = await this.get(`torrents-details.php?id=${torrentId}`);
            if (!html || !html.trim()) throw new Error('HTML vazio.');
            const parser = new DOMParser();
            const doc = parser.parseFromString(html,'text/html');
            const cards = doc.querySelectorAll('.card');
            let cardAgradecimentos = null;
            for (const card of cards) {
                const header = card.querySelector('.card-header');
                if (!header)continue;
                const texto = (header.textContent || '').trim().toLowerCase();
                if (texto === 'agradecimentos') {
                    cardAgradecimentos = card;
                    break;
                }
            }

            if (!cardAgradecimentos)return resultadoPadrao;

            const usuarios = [];
            const linksUsuarios = cardAgradecimentos.querySelectorAll('a[href*="account-details.php?id="]');

            let agradeceu = false;
            for (const link of linksUsuarios) {
                const href = link.getAttribute('href') || '';
                const match = href.match(/account-details\.php\?id=(\d+)/i);

                if (!match)continue;

                const id = Number(match[1]);
                const nome = (link.textContent || '').trim().replace(/\s+/g, ' ');

                if (!usuarios.some(u => u.id === id))usuarios.push({ id, nome });
                if (id === Number(userId))agradeceu = true;
            }

            const resultado = {
                torrentId: Number(torrentId),
                userId: Number(userId),
                agradeceu,
                totalAgradecimentos:
                usuarios.length,
                usuarios
            };

            this.setTorrentCache( torrentId, resultado );

            if ( this.cache && this.cache.agradecimentos ) {
                this.cache.agradecimentos.set( cacheKey, resultado );
            }

            return resultado;
        } catch (erro) {
            this.setLog({tipo: 'erro', classe: 'ASCPlus', texto: `Erro ao verificar agradecimento do torrent ${torrentId}: ${erro.message}`});
            return resultadoPadrao;
        }
    }
    async get(path) {
        const url = path.startsWith('http') ? path : `${this.url}/${path}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => { controller.abort(); }, 15000);
        try {
            const response = await fetch(url, {
                credentials: 'include',
                signal: controller.signal
            });

            if (!response.ok)throw new Error(`HTTP ${response.status} - ${response.statusText}`);

            return await response.text();
        } finally {
            clearTimeout(timeout);
        }
    }
    async executarComLimite(itens, worker, limite = 5) {
        const resultados = [];
        let indice = 0;
        const executores = Array.from({ length: limite }, async () => {
            while ( indice < itens.length) {
                const atual = indice++;
                resultados[atual] = await worker( itens[atual] );
            }
        });
        await Promise.all(executores);
        return resultados;
    }
    /**
    * Agradecer a um determinado Torrent
    * @param {number|string} torrentId
    */
    async agradecerTorrent(torrentId) {
        try {
            this.setLog({tipo:'iniciando', classe: 'ASCPlus', texto: `Enviando agradecimento para torrent de ID: ${torrentId}`});
            await this.get(`thanks.php?id=${torrentId}`);
            const registro = this.getTorrentCache(torrentId);
            if (registro) {
                registro.agradeceu = true;
                registro.ultimaAtualizacao = Date.now();
                this.setTorrentCache( torrentId, registro );
                this.setLog({tipo:'sucesso', classe: 'ASCPlus', texto: `Agradecimento realizado com sucesso para o torrent de ID: ${torrentId}`});
            }
            if ( this.db.torrents[torrentId] ) {
                this.db.torrents[torrentId].agradeceu = true;
                this.db.torrents[torrentId].ultimaAtualizacao = Date.now();
                this.salvarBanco();
            }
            return true;
        } catch (e) {
            this.setLog({ tipo:'erro', classe: 'ASCPlus', texto: `Falha ao agradecer ${torrentId}: ${e.message}`});
            return false;
        }
    }
    async agradecerPendentes() {
        const torrents = await this.verificarTodosDownloads();
        const pendentes = torrents.filter( torrent => !torrent.agradeceu );

        this.setLog({ tipo:'log', classe: 'ASCPlus', texto: `${pendentes.length} torrents pendentes` });

        for (const torrent of pendentes) {
            await this.agradecerTorrent( torrent.id );
            await new Promise( r => setTimeout(r, 1500) );
        }
        return pendentes.length;
    }
    exportCSV(lista) {
        const csv = ['ID;ARQUIVO;AGRADECEU'];
        lista.forEach(item => {
            // Escapa aspas duplas no nome do arquivo (padrão CSV: "" dentro de um campo entre aspas), evitando que um título com aspas quebre o alinhamento das colunas.
            const arquivoCSV = String(item.arquivo ?? '').replace(/"/g, '""');
            csv.push(`${item.id};"${arquivoCSV}";${item.agradeceu}`);
        });
        const blob = new Blob( [csv.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.exportFileCSV;
        a.click();
    }
    obterDados() {
        const dados = this.storage.getDownloadsConsolidados();
        if(Object.keys(dados).length !== 0){
            return {
                ultimaAtualizacao : dados.updateAt,
                total: dados.downloads.torrents.length,
                downloads: dados.downloads.torrents,
                pendentes: Object.values(dados.torrents).filter(valor => valor.agradeceu === false),
                agradecidos: Object.values(dados.torrents).filter(valor => valor.agradeceu === true)
            };
        } else return null;
    }
    async doarPontos(valor) {
        try {
            const response = await fetch(`${this.url}/account-details.php?id=${this.about.uuid}&action=doar`, {
                method: 'POST',
                credentials: 'include',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: `valor=${encodeURIComponent(valor)}`
            });
            const html = await response.text();
            return { sucesso: response.ok, html};
        } catch (erro) {
            this.setLog({ tipo:'erro', classe: 'ASCPlus', texto: `Falha ao doar pontos: ${erro.message}`});
            return { sucesso: false, erro: erro.message };
        }
    }
    async calcularEstatisticas() {
        const dados = this.obterDados();
        const downloads = dados.downloads || [];
        const agradecidos = dados.agradecidos.length;
        const pendentes = downloads.filter( x => !x.agradeceu ).length;
        const percentual = downloads.length ? ( agradecidos / downloads.length * 100 ).toFixed(2) : 0;
        const atualizacao = new Date( dados.ultimaAtualizacao || Date.now() ).toLocaleDateString('pt-BR')
        return {
            total: downloads.length,
            agradecidos,
            pendentes,
            percentual,
            registros: downloads.length,
            origem: dados.origem,
            ultimaAtualizacao: atualizacao
        };
    }
    setLog(e){
        const agora = new Date();
        e.data = agora.toLocaleDateString('pt-BR');
        e.hora = agora.toLocaleTimeString('pt-BR');
        e.script = GM_info.script.name;

        //tipo: 'error', modulo: 'ASCPageCache:get', erro: error.message

        if(e && e.tipo && e.texto){
            try{
                switch(e.tipo){
                    case 'erro': this.ui?.mostrarErro(e.texto || e.erro || e.message); break;
                    case 'sucesso': this.ui?.mostrarSucesso(e.texto); break;
                    case 'log': this.ui?.mostrarAlerta(e.texto); break;
                    case 'iniciando': this.ui?.mostrarStatus(e.texto); break;
                    case 'concluido': this.ui?.removerStatus(); break;
                }
            }catch(err){
                console.log(`Falha ao exibir mensagem ao usuário: ${err}.`);
            }
        }
    }
}

/**
* ============================================================
* Cache persistente do Navigator
* ============================================================
*/
class ASCPageCache {
    constructor(asc){
        this.asc = asc;
        if(!this.asc.db.navigator){
            this.asc.db.navigator = {
                config : structuredClone( ASCNavigatorConfig.DEFAULT ),
                cache : {},
                state : {}
            };
            this.asc.salvarBanco();
        }
    }
    getConfig(){
        return this.asc.db.navigator.config;
    }
    saveConfig(config){
        this.asc.db.navigator.config = config;
        this.asc.salvarBanco();
        this.asc.setLog({ tipo: 'log', classe: 'ASCPageCache', texto: 'Configuração Navigator salva.' });
    }
    getExpirationTimestamp(){
        const cfg = this.getConfig();
        return Date.now() + ( cfg.cache.expirationHours * 60 * 60 * 1000 );
    }
    generateKey(url){
        return btoa( encodeURIComponent(url) );
    }
    get(url){
        try{
            const key = this.generateKey(url);
            const item = this.asc.db.navigator.cache[key];
            if(!item) return null;
            if( Date.now() > item.expiresAt ){
                delete this.asc.db.navigator.cache[key];
                this.asc.salvarBanco();
                return null;
            }
            return item.data;
        }catch(error){
            this.asc.setLog({ tipo: 'error', classe: 'ASCPageCache', erro: error.message });
            return null;
        }
    }
    set(url, data){
        try{
            const key = this.generateKey(url);
            this.asc.db.navigator.cache[key] = {
                createdAt : Date.now(),
                expiresAt : this.getExpirationTimestamp(),
                data
            };
            this.asc.salvarBanco();
            return true;
        }catch(error){
            this.asc.setLog({ tipo: 'erro', classe: 'ASCPageCache', erro: error.message });
            return false;
        }
    }
    cleanup(){
        try{
            const now = Date.now();
            let removidos = 0;
            Object.entries( this.asc.db.navigator.cache ).forEach(([key,item])=>{
                if(now > item.expiresAt){
                    delete this.asc.db.navigator.cache[key];
                    removidos++;
                }
            });
            if(removidos) this.asc.salvarBanco();
            this.asc.setLog({ tipo:'log', classe: 'ASCPageCache', texto:`Navigator cache limpo (${removidos} removidos)` });
        }catch(error){
            this.asc.setLog({ tipo: 'erro', classe: 'ASCPageCache', erro: error.message });
        }
    }
    saveState(url, state){
        this.asc.db.navigator.state[url] = state;
        this.asc.salvarBanco();
    }
    getState(url){
        return ( this.asc.db.navigator.state[url] || null );
    }

}

/**
* ============================================================
* Manipulador de URL
* ============================================================
*/
class ASCURLManager {
    constructor(){
        this.url = new URL(location.href);
    }
    getCurrentPage(){
        const valor = this.url.searchParams.get('page');
        const numero = parseInt(valor);
        if(!isNaN(numero))return numero;

        let atual = 0, ativo = 0;
        document.querySelectorAll('.pagination li').forEach(li => {
            const link = li.querySelector('a');
            if (link) {
                const href = link.getAttribute('href');
                try {
                    // Cria a URL completa e extrai o parâmetro page
                    const url = new URL(href, location.origin);
                    const page = url.searchParams.get('page');
                    if (page) {
                        atual = Number(page); // Converte para número
                        if (li.classList.contains('active') || link.classList.contains('active'))ativo = atual;
                    } else {
                        atual++;
                        if (li.classList.contains('active'))ativo = atual;
                    }
                } catch(e) {
                    console.error('Erro ao processar o link:', href, e);
                }
            }
        });
        // "ativo" já reflete corretamente a página atual tanto para listagens (0-based, ex: torrents.php sem "page" = página 0) quanto para o fórum.
        // Antes retornava "1" fixo para não-fórum, quebrando a detecção da primeira página.
        return ativo;
    }
    buildPageURL(page){
        const url = new URL(location.href);
        url.searchParams.set( 'page', page );
        return url.toString();
    }
}

class ASCInterface {
    /**
     * @param {ASCPlus} asc
     */
    constructor(asc) {
        this.asc = asc;
        this.asc.ui = this; //para poder exibir mensagens de retorno para o usuário
        this.elementos = {
            menu: null,
            badge: null,
            dropdown: null
        };
        this.time_nofify = 4000;
        this.adicionarCSS();
    }
    /**
     * Inicialização
     */
    async init() {
        try {
            await this.atualizarIndicadores();
            await this.criarMenuSuperior();
        } catch (erro) {
            this.asc.setLog({tipo:'erro', classe: 'ASCInterface', texto: erro});
        }
    }
    /**
     * Retorna resumo dos dados
     */
    obterResumo() {
        const dados = this.asc.obterDados();
        return {
            total: dados?.total || 0,
            pendentes: dados?.pendentes.length || 0,
            agradecidos: dados?.agradecidos.length || 0
        };
    }
    /**
     * Atualiza informações
     */
    atualizarIndicadores() {
        const dados = this.asc.obterDados();
        if ( !dados || dados.length === 0 ) {
            this.asc.setLog({ tipo:'log', classe: 'ASCInterface', texto: `Nenhum cache encontrado.` });
            this.processarNovamente(true);
            this.abrirSobreSistema();
            return;
        }
    }
    /**
     * Procura barra superior
     */
    localizarMenuSuperior() {
        const menus = [ 'nav ul.navbar-nav', '.navbar-nav', 'nav ul', 'nav' ];
        for (const seletor of menus) {
            const menu = document.querySelector( seletor );
            if (menu)return menu;
        }
        return null;
    }
    /**
     * Cria item do menu
     */
    criarMenuSuperior() {
        const menu = this.localizarMenuSuperior();
        if (!menu) {
            this.asc.setLog({ tipo:'log', classe: 'ASCInterface', texto: `Nenhum cache encontrado.` });
            return;
        }
        const resumo = this.obterResumo();
        const li = document.createElement('li');
        li.className = 'nav-item dropdown';
        const padding = location.pathname.includes('account-details.php')?'0':'0.5rem 0.5rem 0.5rem';
        li.innerHTML = `
            <a  href="#" class="nav-link dropdown-toggle" data-toggle="dropdown" id="asc-menu" style="padding: ${padding}">
                ASC Tanks: <span id="asc-pendentes" style="color:#ffc107;font-weight:bold;">${resumo.pendentes}</span>
            </a>
            <div class="dropdown-menu dropdown-menu-right" id="asc-dropdown">
                <a class="dropdown-item" href="#" id="asc-ver-pendentes" >🎬 Filmes Pendentes</a>
                <a class="dropdown-item" href="#" id="asc-ver-estatisticas">📊 Estatísticas</a>
                <a class="dropdown-item" href="#" id="asc-processar">🔄 Atualizar Dados</a>
                <div class="dropdown-divider"></div>
                <a class="dropdown-item" href="#" id="asc-navegacao"><span class="fa fa-stream"></span> Navegação</a>
                <a class="dropdown-item" href="#" id="asc-cache"><span class="fa fa-database"></span> Cache</a>
                <div class="dropdown-divider"></div>
                <a class="dropdown-item" href="#" id="asc-exportar">💾 Exportar Cache</a>
                <a class="dropdown-item" href="#" id="asc-importar">📂 Importar Cache</a>
                <div class="dropdown-divider"></div>
                <a class="dropdown-item" href="#" id="asc-sobre">ℹ️ Sobre</a>
            </div>
        `;
        menu.appendChild(li);
        this.registrarEventos();
    }
    /**
     * Eventos do menu
     */
    registrarEventos() {
        const btnPendentes = document.getElementById('asc-ver-pendentes');
        const btnStats = document.getElementById('asc-ver-estatisticas');
        const btnAtualizar = document.getElementById('asc-processar');
        const btnNavegacao = document.getElementById('asc-navegacao');
        const btnMemory = document.getElementById('asc-cache');
        const btnExportar = document.getElementById('asc-exportar');
        const btnImportar = document.getElementById('asc-importar');
        const btnSobre = document.getElementById('asc-sobre');
        const btnModoApresentacao = document.querySelectorAll('button[onclick^="TorrentsModo"]');

        if (btnPendentes) {
            btnPendentes.addEventListener('click', e => {
                e.preventDefault();
                this.renderizarPendentes();
            });
        }
        if (btnStats) {
            btnStats.addEventListener('click', e => {
                e.preventDefault();
                this.abrirEstatisticas();
            });
        }
        if (btnAtualizar) {
            btnAtualizar.addEventListener('click', async e => {
                e.preventDefault();
                await this.processarNovamente();
            });
        }
        if (btnNavegacao) {
            btnNavegacao.addEventListener('click', e => {
                e.preventDefault();
                new ASCNavigatorSettings( this.asc ).open();
            });
        }
        if(btnMemory){
            btnMemory.addEventListener('click', e => {
                e.preventDefault();
                new ASCNavigatorStats(this.asc).open();
            });
        }
        if (btnExportar) {
            btnExportar.addEventListener('click', e => {
                e.preventDefault();
                this.asc.exportarCache();
            });
        }
        if (btnImportar) {
            btnImportar.addEventListener('click', e => {
                e.preventDefault();
                this.importarArquivo();
            });
        }
        if (btnSobre) {
            btnSobre.addEventListener('click', e => {
                e.preventDefault();
                this.abrirSobreSistema();
            });
        }
        //Sempre que usuário modifica o modo de apresentação o cache necessita ser limpo
        btnModoApresentacao.forEach((botao) => {
            let asc = this.asc;
            botao.addEventListener('click', () => {
                new ASCNavigatorCacheManager(asc).clear(false);
            });
        });

    }
    /**
     * Lista filmes pendentes no console, utilizado somente paa testes
     */
    async exibirPendentes() {
        const pendentes = await this.asc.getPendentes();
        console.table( pendentes );
        this.asc.setLog({ tipo:'log', classe: 'ASCInterface', texto: `Existem ${pendentes.length} torrents pendentes.\n\nVeja o console para detalhes.` });
    }
    /**
    * Atualiza completamente o banco de dados local.
    */
    async processarNovamente(perguntar = true) {
        try {
            if(perguntar){
                const confirmar = window.confirm(
                    `Deseja atualizar os dados de agradecimento de Torrents baixados e armazenados em cache do aplicativo ${GM_info.script.name}?\n\n` +
                    `Esta operação pode levar alguns minutos dependendo da quantidade de downloads que você realizou.\n` +
                    `A janela onde a operação esta sendo realizada não deve ser fechada para o processamento correto da aplicação.\n`
                );
                if (!confirmar)return;
            }
            this.mostrarStatus('Iniciando atualização completa dos downloads...','alert-info', true);
            const inicio = Date.now();
            const resultado = await this.asc.verificarTodosDownloads(progresso => {
                this.mostrarStatus(
                   `<div class="progress mt-2">
                         <div id="asc-progress" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width:${progresso.percentual}%">
                         (${progresso.atual}/${progresso.total}) - ${progresso.percentual}%
                         </div>
                    </div>`, 'alert-info', true);
                this.atualizarContador();
            });
            const tempo = ((Date.now() - inicio) / 1000).toFixed(1);
            this.mostrarStatus(`Atualização concluída com sucesso! ${resultado.length} registros processados em ${tempo}s.`,'alert-success', false);
            this.atualizarIndicadores();
            setTimeout(() => { location.reload(); }, 3000);
        } catch (erro) {
            this.mostrarStatus( `Erro durante atualização: ${erro.message}`, 'alert-danger', false);
        }
    }
    /**
     * Importação
     */
    importarArquivo() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async event => {
            const arquivo = event.target.files[0];
            if (!arquivo)return;
            const texto = await arquivo.text();
            this.asc.importarCache( texto );
            location.reload();
        };
        input.click();
    }
    renderizarPendentes() {
        const resumo = this.obterResumo();
        const html = `
        <div class="card-header bg-warning d-flex justify-content-between align-items-center">
            <div>
                 <button id="asc-recarregar-pendentes" class="btn btn-primary btn-sm mr-2">Atualizar</button>
                 <button id="asc-agradecer-todos" class="btn btn-success btn-sm mr-2">Agradecer Todos</button>
            </div>
        </div>
        <div class="card-body">
            <div class="row text-center mb-3">
                <div class="col-md-4"><strong>Total: </strong>${resumo.total}</div>
                <div class="col-md-4"><strong>Pendentes: </strong><span id="asc-pendentes-totais">${resumo.pendentes}</span></div>
                <div class="col-md-4"><strong>Agradecidos: </strong><span id="asc-agradecidos-totais">${resumo.agradecidos}</span></div>
            </div>
        </div>
        <ul class="list-group list-group-flush" id="asc-lista-pendentes"></ul>
        `;
        const modal = this.criarJanela({ id: 'asc-painel-pendentes', titulo: `🎬 Filmes Pendentes <span id="asc-pendentes-total"></span>`, conteudo: html, class: 'asc-card-interface'});

        modal.querySelector('#asc-agradecer-todos').addEventListener( 'click', () => this.agradecerTodosPendentes() );

        const ul = modal.querySelector('#asc-lista-pendentes');
        this.asc.obterDados().pendentes.forEach( item => { ul.appendChild( this.criarLinhaPendente(item) ); } );
    }
    criarLinhaPendente(item) {
        const li = document.createElement('li');
        li.id = `asc-pendente-${item.id}`;
        li.className = 'list-group-item';

        const totalThanks = item.totalAgradecimentos || 0;

        li.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div>
                <div>🎬 <a href="/torrents-details.php?id=${item.id}" target="_blank">${item.arquivo ? escapeHTML(item.arquivo) : `Torrent #${item.id}`}</a></div>
                <small class="text-muted">ID: ${item.id} | Agradecimentos: ${totalThanks}</small>
            </div>
            <div>
                <!-- span class="badge badge-danger mr-2">Pendente</span -->
                <button class="btn btn-success btn-sm asc-btn-agradecer">Agradecer</button>
            </div>
        </div>
        `;
        li.querySelector('.asc-btn-agradecer').addEventListener( 'click', () => this.agradecerTorrent(item.id) );
        return li;
    }
    removerLinhaPendente(idTorrent) {
        const linha = document.getElementById(`asc-pendente-${idTorrent}`);
        if (linha)linha.remove();
        this.atualizarContador();
        const restante = document.querySelectorAll('[id^="asc-pendente-"]').length;
        if (restante === 0)this.mostrarSucesso('Todos os filmes foram agradecidos!');
    }
    /**
    * Cria uma janela modal Bootstrap
    *
    * @param {Object} options
    * @param {String} options.id
    * @param {String} options.titulo
    * @param {String} options.conteudo
    * @param {String} options.tamanho
    * @param {Function|null} options.onSave
    */
    criarJanela(options = {}) {
        try {
            const config = {
                id: options.id || `asc-modal-${Date.now()}`,
                titulo: options.titulo || 'ASC',
                conteudo: options.conteudo || '',
                tamanho: options.tamanho || 'modal-lg',
                class : options.class || '',
                onSave: options.onSave || null
            };
            const existente = document.getElementById(config.id);
            if (existente)existente.remove();
            const wrapper = document.createElement('div');
            wrapper.innerHTML = `
            <div class="modal fade ${config.class}" id="${config.id}" tabindex="-1" role="dialog" aria-hidden="true">
                <div class="modal-dialog ${config.tamanho}" role="document">
                    <div class="modal-content">
                        <div class="modal-header bg-dark text-white">
                            <h5 class="modal-title">${config.titulo}</h5>
                            <button type="button" class="close text-white" data-dismiss="modal" aria-label="Fechar">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">${config.conteudo}</div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Fechar</button>
                            ${config.onSave? `<button type="button" class="btn btn-success" id="${config.id}-save">Salvar</button>`: ''}
                        </div>
                    </div>
                </div>
            </div>
            `;
            document.body.appendChild( wrapper.firstElementChild );
            const modal = document.getElementById(config.id);
            if ( config.onSave ) {
                modal.querySelector(`#${config.id}-save`).addEventListener( 'click', async () => {
                    try {
                        await config.onSave();
                    } catch (error) {
                        if ( window.asc && window.asc.setLog )window.asc.setLog({ tipo: 'erro', classe: 'ASCInterface', erro: error.message });
                    }
                });
            }
            if ( typeof $ !== 'undefined' ) {
                $(modal).modal('show');
                $(modal).on( 'hidden.bs.modal', () => { modal.remove(); } );
            } else modal.style.display = 'block';
            return modal;
        } catch (error) {
            this.mostrarErro(`Erro ao criar janela de apresentação dos dados: ${error.message}`);
            return null;
        }
    }
    async agradecerTorrent(torrentId) {
        try {
            this.mostrarStatus('Agradendo Torrent!');
            const response = await fetch(`${this.asc.url}/thanks.php?id=${torrentId}`, { credentials: 'include' });
            if (!response.ok)throw new Error(`HTTP ${response.status} - ${response.statusText}`);
            const torrent = this.asc.getTorrentCache(torrentId);
            if (torrent) {
                torrent.agradeceu = true;
                torrent.ultimaVerificacao = Date.now();
                this.asc.setTorrentCache( torrentId, torrent );
            }
            const linha = document.getElementById(`asc-pendente-${torrentId}`);
            if (linha)this.removerLinhaPendente(torrentId);
            this.mostrarSucesso('Agradecimento realizado com sucesso.');
        } catch (erro) {
            this.mostrarErro(`Erro ao agradecer Torrent: ${erro.message}`);
        }
    }
    //Atualização automática do contador
    atualizarContador() {
        const resumo = this.obterResumo();
        const badge = document.getElementById('asc-pendentes-badge');
        if (badge) badge.textContent = resumo.pendentes;

        const totalLista = document.getElementById('asc-pendentes-total');
        if (totalLista)totalLista.textContent = `(${resumo.pendentes})`;

        const pendentes = document.getElementById('asc-pendentes-totais');
        if (pendentes)pendentes.textContent = resumo.pendentes;

        const agradecidos = document.getElementById('asc-agradecidos-totais');
        if (agradecidos)agradecidos.textContent = resumo.agradecidos;
    }
    async agradecerTodosPendentes() {
        this.mostrarStatus('Agradendo todos os Torrents!');
        const pendentes = await this.asc.getPendentes();
        let processados = 0;
        for ( const torrent of pendentes ) {
            this.mostrarStatus(`🖖 Agradecendo ${processados}/${pendentes.length}...`);
            try {
                await this.agradecerTorrent(torrent.id);
                const registro = this.asc.storage.getDownloadsConsolidados()[torrent.id];
                if (registro) {
                    registro.agradeceu = true;
                    registro.updatedAt = Date.now();
                    this.asc.storage.salvarTorrent(registro);
                }
                let nome = escapeHTML(torrent.arquivo || '');
                let percentual = Math.round(( (processados + 1) / pendentes.length ) * 100 )
                this.mostrarStatus(
                    `<div class="progress mt-2">
                         <div id="asc-progress" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width:${percentual}%">
                         ${nome} (${processados}/${pendentes.length}) - ${percentual}%
                         </div>
                    </div>`, 'alert-info', true);
                processados++;
                await new Promise( resolve => setTimeout( resolve, 1000) );
            } catch (e) {
                this.asc.setLog({tipo: 'erro', classe: 'ASCInterface', erro: e});
            }
        }
        this.mostrarSucesso(`👍 Total de ${processados} agradecidos!`);
    }
    abrirSobreSistema() {
        const resumo = this.obterResumo();
        const html = `
        <div class="card-body">
            <h1>${GM_info.script.name} <span style='font-size:11pt'>${GM_info.script.version}v</span></h1>
            <p style='text-align:left;'>Create by ${GM_info.script.author} (<a href='${GM_info.script.homepage}'>${GM_info.script.homepage}</a>)</p>
            <p></p>
            <p style='text-align: center;'>${GM_info.script.description}</p>
            <hr>
            <p>Algumas das funcionalidades que o Script adiciona:</p>
            <ul class="list-group mb-3">
                <li class="list-group-item">✔ Verificação automática de agradecimentos</li>
                <li class="list-group-item">✔ Cache persistente LocalStorage + Cookies + GM Storage</li>
                <li class="list-group-item">✔ Agradecimento individual</li>
                <li class="list-group-item">✔ Agradecimento em lote</li>
                <li class="list-group-item">✔ Exportação e importação dos dados em cache</li>
                <li class="list-group-item">✔ Carregamento de páginas via scroll page (rolagem infinita)</li>
                <li class="list-group-item">✔ Carregamento de páginas via formulário</li>
            </ul>
            <hr>

            <h4>Contribuição</h4>
            <p>Caso o sistema tenha sido útil, considere enviar alguns ASC Bônus para ajudar a incentivar no desenvolvimento.</p>
            <div id="asc-botoes-doacao" class="mb-3 d-flex align-items-center justify-content-center"></div>
            <hr>

            <h4>Melhorias</h4>
            <p>Em breve, novas melhorias serão adicionadas!</p>
            <p>
               Dê um incentivo para o projeto neste <a href="forum.php?action=ver_topico&id=1578">link do fórum</a> e:
               <ul class="list-group mb-3">
                  <li class="list-group-item">Deixe a sua opinião sobre a ferramenta.</li>
                  <li class="list-group-item">Sugira quais outros recursos ela deveria ter.</li>
                  <li class="list-group-item">Informe sobre problemas e dificuldades.</li>
               </ul>
            </p>
            <hr>

            <h4>Dados do Projeto</h4>
            <p>Quer participar do projeto?</p>
            <ul class="list-group mb-3">
                <li class="list-group-item">Projeto no Github: <a href='${GM_info.script.namespace}'>${GM_info.script.namespace}</a></li>
                <li class="list-group-item">Home Page do Criador: <a href='${GM_info.script.homepage}'>${GM_info.script.homepage}</a></li>
                <li class="list-group-item">Suporte: <a href='${GM_info.script.supportURL}'>${GM_info.script.supportURL}</a></li>
                <li class="list-group-item">Link para Updates: <a href='${GM_info.script.updateURL}'>${GM_info.script.updateURL}</a></li>
                <li class="list-group-item">Link para Download: <a href='${GM_info.script.downloadURL}'>${GM_info.script.downloadURL}</a></li>
            </ul>

            <hr>
            <h4>Torrents e seus status de agradecimento</h4>
            <div class="row">
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body text-center">
                            <h4>${resumo.total}</h4>
                            <small>Torrents Catalogados</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body text-center">
                            <h4>${resumo.pendentes}</h4>
                            <small>Pendentes</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body text-center">
                            <h4>${resumo.agradecidos}</h4>
                            <small>Agradecidos</small>
                        </div>
                    </div>
                </div>
            </div>
            <p style='font-size:8pt;textoalign:center;'>*O sistema mantém um banco local persistente contendo os torrents encontrados e seus respectivos estados de agradecimento.</p>
        </div>
        `;
        this.criarJanela({ id: 'asc-sobre', titulo: 'ℹ️ Sobre o Sistema', conteudo: html, class: 'asc-card-interface'});
        this.criarBotoesDoacao();
    }
    criarBotoesDoacao() {
        const valores = [100, 500, 1000, 5000, 10000];
        const container = document.getElementById('asc-botoes-doacao');
        valores.forEach(valor => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-success m-1';
            btn.textContent = `${valor.toLocaleString()} ASC`;
            btn.addEventListener( 'click', () => this.doarPontos(valor) );
            container.appendChild(btn);
        });
    }
    async doarPontos(valor) {
        const resultado = await this.asc.doarPontos(valor);
        if (resultado.sucesso) this.mostrarSucesso(`Obrigado pela contribuição de ${valor} ASC!`);
        else this.mostrarErro( 'Falha ao realizar doação!');
    }
    /**
    * Insere o painel ASC na mesma região
    * onde o site exibe suas listagens.
    *
    * @param {HTMLElement} painel
    */
    inserirPainel(painel) {
        try {
            this.fecharPainelASC();
            const alvo = document.querySelector('.col-sm-10.col-md-10.col-lg-10');
            if (alvo)alvo.insertBefore( painel, alvo.firstChild );
            else {
                const profile = document.querySelector('.fb-profile-block-menu');
                if(profile){
                    const card = document.createElement('div');
                    card.className = 'col-lg-12 col-md-12 col-sm-12 col-xs-12';
                    card.append(painel);
                    profile.after(card);
                }
            }
            painel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (erro) {
            this.asc.setLog({ tipo: 'erro', classe: 'ASCInterface', texto: `Erro ao inserir painel: ${erro.message}`});
        }
    }
    fecharPainelASC() {
        document.querySelectorAll('.asc-card-interface').forEach(el => el.remove());
    }
    async abrirEstatisticas() {
        const stats = await this.asc.calcularEstatisticas();
        const html = `
        <div class="card-body">
            <div class="row">
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header bg-primary text-white">Resumo Geral</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item">🍹Total de Torrents: <strong>${stats.total}</strong></li>
                            <li class="list-group-item">👍 Agradecidos: <strong>${stats.agradecidos}</strong></li>
                            <li class="list-group-item">🚨 Pendentes: <strong>${stats.pendentes}</strong></li>
                            <li class="list-group-item">🦉 Taxa de Conclusão: <strong>${stats.percentual}%</strong></li>
                        </ul>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header bg-success text-white">📤 Cache</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item">✏️ Registros: <strong>${stats.registros}</strong></li>
                            <li class="list-group-item">📄 Fonte: <strong>${stats.origem || 'Sistema'}</strong></li>
                            <li class="list-group-item">⏰ Última Atualização: <strong>${stats.ultimaAtualizacao}</strong></li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="alert alert-info small">
                <strong>ℹ️ Sobre estes números:</strong>
                Todas as informações exibidas acima são calculadas a partir do armazenamento local persistido pelo script "${GM_info.script.name}",
                reduzindo requisições ao servidor e aumentando significativamente a velocidade do sistema.
            </div>
        </div>
        `;
        this.criarJanela({ id: 'asc-estatisticas', titulo: '📊 Estatísticas do Sistema', conteudo: html, class: 'asc-card-interface'});
    }
    /**
    * Exibe uma mensagem de status não invasiva.
    *
    * @param {String} texto
    * @param {String} tipo
    * @param {Boolean} spinner
    */
    mostrarStatus( texto, tipo = 'alert-info', spinner = true ) {
        let status = document.getElementById('asc-status');
        if (!status) {
            status = document.createElement('div');
            status.id = 'asc-status';
            status.style.cssText = `position: fixed;bottom: 20px;left: 20px;z-index: 999999;min-width: 350px;
            max-width: 600px;box-shadow: 0 4px 12px rgba(0,0,0,.25);transition: all .3s ease;`;
            document.body.appendChild(status);
        }
        status.className = `alert ${tipo} mb-0`;
        const icone = spinner ? '<i class="fas fa-spinner fa-spin mr-2"></i>' : '';
        status.innerHTML = `<div class="d-flex align-items-center">${icone}<span>${texto}</span></div>`;
        status.style.display = 'block';
    }
    mostrarSucesso(texto) {
        this.mostrarStatus( texto, 'alert-success', false );
        setTimeout(() => {
            const toast = document.getElementById('asc-status');
            if (toast)toast.remove();
        }, 4000);
    }
    mostrarErro(texto) {
        this.mostrarStatus( texto, 'alert-danger', false );
        setTimeout(() => {
            const toast = document.getElementById('asc-status');
            if (toast) toast.remove();
        }, 6000);
    }
    mostrarAlerta(texto) {
        this.mostrarStatus( texto, 'alert-warning', false );
        setTimeout(() => {
            const toast = document.getElementById('asc-status');
            if (toast) toast.remove();
        }, 6000);
    }
    removerStatus() {
        const toast = document.getElementById('asc-status');
        if (toast) toast.remove();
    }
    adicionarCSS() {
        if (document.getElementById('asc-css'))return;
        const style = document.createElement('style');
        style.id = 'asc-css';
        style.textContent = `
        .asc-card-interface{ box-shadow:0 0 10px rgba(0,0,0,.15); }
        .asc-card-interface .list-group-item:hover{ background:#f8f9fa; }
        .asc-card-interface a{ font-weight:bold; }
        .asc-card-interface .badge{ font-size:11px;}
        `;
        document.head.appendChild(style);
    }
}

/**
* ============================================================
* ASC Navigator - Configuração e Cache
* ============================================================
*/
class ASCNavigatorConfig {
    static DEFAULT = {
        enabled : true,
        mode : 'scroll',
        floatingToolbar : true,
        hideOriginalPagination : true,
        showSeparator : true,
        showPageNumber : true,
        showItemCount : true,
        restorePages : true,
        forumOrder : 'desc',
        cache : {
            enabled : true,
            expirationHours : 24,
            maxPages : 500
        }
    };
}

/**
* ============================================================
* Detector de paginação
* ============================================================
*/
class ASCPagination {
    constructor(){
        this.urlManager = new ASCURLManager();
    }
    detect(){
        const pagination = document.querySelector('.pagination');
        if(!pagination) return { hasPagination:false };
        const pages = [];
        pagination.querySelectorAll('a').forEach(link=>{
            try{
                const url = new URL(link.href);
                const page = parseInt( url.searchParams.get('page') );
                if(!isNaN(page))pages.push(page);
            }catch(e){}
        });
        const current = this.urlManager?.getCurrentPage() ?? 0;

        let lastPage = Math.max(...pages);

        const forum = location.href.includes('ver_topico');
        if(forum){
            const ultimo = [...pages].pop();
            if(ultimo && !isNaN(ultimo)) lastPage = ultimo - 1;
        }
        return {
            hasPagination : true,
            currentPage : current?.pagina ?? 0,
            firstPage : 0,
            lastPage
        };
    }
}

/**

* ============================================================
* Loader AJAX
* ============================================================
*/
class ASCPageLoader {
    constructor(asc){
        this.asc = asc;
        this.cache = new ASCPageCache(asc);
    }
    async load(url){
        try{
            const cached = this.cache.get(url);
            if(cached){
                this.asc.setLog({ tipo: 'log', classe: 'ASCPageLoader', texto: `Dados contidos em Cache: ${url}` });
                return cached;
            }
            this.asc.setLog({ tipo: 'log', texto:`Ajax GET: ${url}` });
            const response = await fetch( url, { credentials:'include' } );
            if(!response.ok)throw new Error( `HTTP ${response.status} - ${response.statusText}` );
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString( html, 'text/html' );
            const result = { url, html, document: doc, timestamp: Date.now() };
            this.cache.set( url, result );
            return result;
        }catch(error){
            this.asc.setLog({ tipo: 'erro', classe: 'ASCPageLoader', erro: `Erro ao iniciar carregamento de página: ${error.message}` });
            throw error;
        }
    }
    mode(){
        document.querySelectorAll('button[onclick^="TorrentsModo"]').forEach(function(botao) {
            botao.addEventListener('click', function() {

            });
        });
    }
}

/**
* ============================================================
* Separador de páginas
* ============================================================
*/
class ASCSeparator {
    static create(page, total){
        const div = document.createElement('div');
        div.className = 'alert alert-secondary my-3';
        div.innerHTML = `<div class="text-center"><strong>Página ${page}</strong><span class="ml-2">(${total} itens)</span></div>`;
        return div;
    }
    static createLoading(page){
        const div = document.createElement('div');
        div.className = 'alert alert-info text-center';
        div.innerHTML = `<span class="spinner-border spinner-border-sm mr-2"></span>Carregando página ${page}...`;
        return div;
    }
}

/**
* ============================================================
* Parser principal
* ============================================================
*/
class ASCPageParser {
    constructor(asc){
        this.asc = asc;
    }
    parse(result){
        const type = this.detectType(result);
        switch(type){
            case 'forum': return new ASCForumParser( this.asc ).parse(result);
            case 'log': return new ASCLogParser( this.asc ).parse(result);
            default: return new ASCGenericParser( this.asc ).parse(result);
        }
    }
    detectType(result){
        const url = result.url ?? location.href;
        if( url.includes('ver_topico') || url.includes('torrents-details.php') )return 'forum';
        if( url.includes('log.php') )return 'log';
        return 'generic';
    }
}

/**
* ============================================================
* Parser genérico
* ============================================================
  */
class ASCGenericParser {
    constructor(asc){
        this.asc = asc;
    }
    parse(result){
        const parser = new DOMParser();
        const doc = parser.parseFromString(result.html, 'text/html');
        const elementos = this.detectTypeContainer(doc);
        return {
            tipo: 'generico',
            loading: elementos.loading,
            separador: elementos.separador,
            elemento: elementos.elemento,
            html: result.html,
            itens: elementos.itens,
            totalItems: elementos.itens ? elementos.itens.length : 0
        };
    }
    detectTypeContainer(doc){
        try{
            const ul = doc.querySelector('#fancy-list-group > ul.list-group')?.querySelectorAll('li') ?? null;
            const table = doc.querySelector('tbody') ?? doc.querySelector('.row') ?? doc.querySelector('.table-responsive') ?? doc.querySelector('table') ?? null;
            const card = doc.querySelector('div.container_capas') ?? null;
            if(card){
                const cards = doc.querySelectorAll('div.container_capas div.movie-card');
                const pais = Array.from(cards).map(card => card.parentElement);
                const divs = [...new Set(pais)];
                return {
                    itens: divs,
                    elemento : 'div',
                    separador: Object.assign(document.createElement('div'), { innerHTML: '<div class="conteudo_separador"></div>', className: 'asc-page-separator col-md-4 col-sm-5 col-lg-3 col-xs-3' }),
                    loading: Object.assign(document.createElement('div'), { innerHTML: '<div class="load"></div>', className: 'loadBar col-md-4 col-sm-5 col-lg-3 col-xs-3' }),
                };
            }
            else if( ul ){
                return {
                    itens: ul,
                    elemento : 'li',
                    separador: Object.assign(document.createElement('ul'), { innerHTML: '<li class="list-group-item asc-page-separator"><div class="conteudo_separador"></div></li>' }).querySelector('li'),
                    loading: Object.assign(document.createElement('ul'), { innerHTML: '<li class="list-group-item"><div class="loadBar load"></div></li>' }).querySelector('li'),
                };
            }
            else if(table){
                return {
                    itens: table.querySelectorAll('tr'),
                    elemento : 'tr',
                    separador: Object.assign(document.createElement('table'), { innerHTML: '<tr class="asc-page-separator"><td colspan="2"><div class="conteudo_separador"></div></td></tr>' }).querySelector('tr'),
                    loading: Object.assign(document.createElement('table'), { innerHTML: '<tr class="loadBar"><td colspan="2" class="load"></td></tr>' }).querySelector('tr'),
                };
            }
        }catch(e){
            this.asc.setLog({ tipo: 'erro', classe: 'ASCGenericParser', erro: `Falha ao detectar container: ${e.message}` });
        }
    }
}

/**
* ============================================================
* Parser Log
* ============================================================
*/
class ASCLogParser {
    constructor(asc){
        this.asc = asc;
    }
    parse(result){
        const parser = new DOMParser();
        const doc = parser.parseFromString(result.html, 'text/html');
        const table = doc.querySelector('table');
        return {
            tipo: 'log',
            elemento : 'tr',
            separador: Object.assign(document.createElement('table'), { innerHTML: '<tr class="asc-page-separator"><td colspan="2"><div class="conteudo_separador"></div></td></tr>' }).querySelector('tr'),
            loading: Object.assign(document.createElement('table'), { innerHTML: '<tr class="loadBar"><td colspan="2" class="load"></td></tr>' }).querySelector('tr'),
            html: table ? table.innerHTML : '',
            itens: table?.querySelectorAll('tr'),
            totalItems: table ? table.querySelectorAll('tr').length -1 : 0
        };
    }
}

/**
* ============================================================
* Parser Fórum
* ============================================================
*/
class ASCForumParser {
    // Apesar do nome, também é usado para a paginação de comentários de torrents-details.php (registrado em ASCPageParser.detectType()) — a marcação
    // do card "Comentários" é idêntica em ambas as páginas, só muda a posição dele dentro do layout.
    // Por isso a busca usa encontrarCardBodyComentarios() (por texto do h5) em vez de um seletor fixo por nth-child.
    constructor(asc){
        this.asc = asc;
    }
    parse(result){
        const parser = new DOMParser();
        const doc = parser.parseFromString(result.html, 'text/html');
        const cardBody = encontrarCardBodyComentarios(doc);
        const comentarios = cardBody ? [...cardBody.querySelectorAll('.row:not([data-page])')] : [];
        // titulo/topico só existem em tópicos de fórum (torrents-details.php não tem
        // esse cabeçalho) — mantidos como best-effort, sem quebrar o parse quando ausentes.
        const titulo = doc.querySelector('body > div.container-fluid > div > div.col-sm-10.col-md-10.col-lg-10.p-2.mb-5 > div:nth-child(1) > h5 > span')?.textContent ?? null;
        const topico = doc.querySelector('body > div.container-fluid > div > div.col-sm-10.col-md-10.col-lg-10.p-2.mb-5 > div:nth-child(1) > div > nav ~ div.row') ?? null;
        return {
            tipo : 'forum',
            elemento : 'div',
            class : 'row',
            separador : Object.assign(document.createElement('div'), { innerHTML: '<div class="col-sm-2"></div><div class="col-sm-10 conteudo_separador"></div>', className: 'row asc-page-separator' }),
            loading: Object.assign(document.createElement('div'), { innerHTML: '<div class="loadBar col-sm-2"></div><div class="loadBar col-sm-10 load"></div>', className: 'row' }),
            itens : comentarios,
            titulo : titulo,
            topico : topico,
            totalItems : comentarios.length,
        };
    }
}

/**
* ============================================================
* ASC Navigator
* Motor principal de navegação AJAX
* ============================================================
*/
class ASCNavigator {
    constructor(asc){
        this.asc = asc;
        this.cache = new ASCPageCache(asc);
        this.loader = new ASCPageLoader(asc);
        this.parser = new ASCPageParser(asc);
        this.pagination = new ASCPagination(asc);
        this.urlManager = new ASCURLManager();
        this.loadedPages = new Map();
        this.loadingPages = new Set();
        this.observer = null;
        this.info = this.pagination.detect();
    }
    /**
    * Inicialização
    */
    async init(){
        try{
            const config = this.cache.getConfig();
            if(!config.enabled)return;
            if(!this.info.hasPagination)return;
            this.asc.setLog({ tipo: 'log', classe: 'ASCNavigator', texto: 'ASC Navigator iniciado.' });
            this.context = this.detectContext();
            if(config.hideOriginalPagination )this.hidePagination();
            this.registerCurrentPage();
            if(config.restorePages)await this.restorePages();
            if(config.mode === 'scroll')await this.startInfiniteScroll();
            if(config.floatingToolbar){
                this.floatingBar = new ASCNavigatorFloatingBar(this);
                this.floatingBar.create();
            }
        }catch(error){
            this.asc.setLog({ tipo: 'erro', classe: 'ASCNavigator', erro: `Erro ao iniciar aplicação: ${error.message}` });
        }
    }
    /**
    * Retorna a página atualmente mais visível
    */
    getLastVisiblePage(){
        const wrappers = [...document.querySelectorAll('.asc-page-separator')];
        if(!wrappers.length)return this.info.currentPage;
        let pageAtual = this.info?.currentPage ?? 0;
        let maiorArea = 0;
        wrappers.forEach( wrapper => {
            const rect = wrapper.getBoundingClientRect();
            const visibleTop = Math.max(0,rect.top);
            const visibleBottom = Math.min( window.innerHeight, rect.bottom );
            const area = Math.max( 0, visibleBottom - visibleTop );
            if(area > maiorArea){
                maiorArea = area;
                pageAtual = Number(wrapper.dataset.page);
            }
        });
        return pageAtual;
    }
    detectContext(){
        // =================================================
        // FORUM / COMENTÁRIOS (torrents-details.php)
        // =================================================
        const cardComentarios = encontrarCardBodyComentarios(document);
        if(cardComentarios){
            return {
                type : 'forum',
                container : document.body,
                total: cardComentarios.querySelectorAll('.row:not([data-page])').length
            };
        }

        // =================================================
        // TABELAS
        // =================================================
        const tbody = document.querySelector('table tbody');
        if(tbody){
            return {
                type : 'table',
                container : document.body,
                total: tbody.querySelectorAll('tr').length
            };
        }

        // =================================================
        // LISTAS
        // =================================================
        const list = document.querySelector('#fancy-list-group > ul.list-group');
        if(list){
            return {
                type : 'list',
                container : document.body,
                total: list.querySelectorAll('li').length
            };
        }

        // =================================================
        // CAPAS
        // =================================================
        const card = document.querySelector('div.container_capas');
        const cards = document.querySelectorAll('div.container_capas div.movie-card');
        if(cards){
            // Mapeia cada card para o seu elemento pai direto
            const pais = Array.from(cards).map(card => card.parentElement);
            // remove duplicados
            const divs = [...new Set(pais)];
            return {
                type : 'capas',
                container : document.body,
                total: divs.length
            };
        }

        // =================================================
        // FALLBACK
        // =================================================
        return {
            type : 'generic',
            container : document.body,
            total : 0
        };
    }
    /**
    * Oculta paginação original
    */
    hidePagination(){
        document.querySelectorAll('.pagination').forEach( el => { el.style.display = 'none'; });
    }
    /**
    * Registra página atual
    */
    registerCurrentPage(){
        const current = this.info.currentPage;
        this.loadedPages.set(current, {
            page : current,
            next : this.getNextPageFromDocument(document)
        });
        this.saveState();
    }
    /**
    * Salva estado
    */
    saveState(){
        try{
            const state = {
                pages : [...this.loadedPages.keys()].sort( (a,b) => a-b ),
                updatedAt : Date.now()
            };
            this.asc.db.navigator.state[ location.pathname ] = state;
            this.asc.salvarBanco();
        }catch(error){
            this.asc.setLog({ tipo: 'erro', classe: 'ASCNavigator', erro: `Erro ao salvar páginas carregadas": ${error.message}` });
        }
    }
    async indicadorInicio(){
        const elemento = document.querySelector('.asc-page-separator');
        if (!elemento || elemento?.offsetParent === null) {
            const html = document.documentElement.outerHTML;
            try{
                const page = 0;
                const parsed = await this.parser.parse({html: html});
                const inicial = this.getPosicaoInsercao(page, parsed);
                const sprtr = ASCSeparator.create(page, parsed.totalItems );
                parsed.separador.dataset.page = page;
                parsed.separador.querySelector('.conteudo_separador')?.append(sprtr);
                inicial?.elemento?.insertAdjacentElement(inicial.metodo, parsed.separador);
            }catch(e){
                this.asc.setLog({ tipo: 'erro', classe: 'ASCNavigator', erro: `Erro ao construir separador inícial: ${e.message}` });
            }
        }
    }
    /**
    * Restaura páginas já carregadas
    */
    async restorePages(){
        try{
            const state = this.asc.db.navigator.state[ location.pathname ];
            if(!state) return;
            await this.indicadorInicio();
            for( const page of state.pages ){
                if( page === this.info.currentPage )continue;
                console.log(`Entrou aqui para carregar conteudo da página número ${page}...`)
                await this.loadPage(page);
            }
        }catch(error){
            this.asc.setLog({ tipo: 'erro', classe: 'ASCNavigator', erro: `Erro ao retornar página contida em cache: ${error.message}` });
        }
    }
    getPosicaoInsercao(page, parsed) {
        const separadores = [...document.querySelectorAll('.asc-page-separator')];
        if (page == 0 || !separadores.length || separadores.length == 0) {
            // Não existe nenhuma página carregada ainda: o separador (geralmente o da página 0) vai para o topo do conteúdo, como primeiro item.
            return {
                elemento:
                   document.querySelector(`table tr:first-child`) ??
                   document.querySelector(`div.container_capas div:first-child`) ??
                   document.querySelector(`#fancy-list-group > ul.list-group li:first-child`) ??
                   encontrarCardBodyComentarios(document)?.querySelector('.row:first-child'),
                metodo: 'beforebegin'
            }
        }
        const i = separadores.findIndex(e => +e.dataset.page > page);

        // Página será inserida depois da última ou entre duas páginas
        const separador = i < 0 ? separadores.at(-1) : separadores[i - 1];
        let ultimo = separador;
        const tag = (parsed?.elemento || '').toLowerCase();
        const classeExtra = parsed?.class;
        for (
            let el = separador.nextElementSibling;
            el && !el.classList.contains('asc-page-separator');
            el = el.nextElementSibling
        ) {
            const ehItemReal =
                tag && el.tagName.toLowerCase() === tag &&
                (!classeExtra || el.classList.contains(classeExtra)) &&
                !el.classList.contains('loadBar') &&
                !el.matches('form');
            if (ehItemReal)ultimo = el;
        }
        return {
            elemento: ultimo,
            metodo: 'afterend'
        };
    }
    /**
    * Carrega página específica
    */
    async loadPage(page){
        try{
            if( this.loadedPages.has(page) ){
                this.scrollToPage(page);
                return;
            }
            if( this.loadingPages.has(page) )return;
            this.loadingPages.add(page);
            this.asc.setLog({ tipo: 'iniciando', classe: 'ASCNavigator', texto: `Carregando página ${page}` });
            const url = this.urlManager.buildPageURL(page);
            const response = await this.loader.load(url);
            const parsed = await this.parser.parse(response);
            if(parsed.totalItems == 0){
                this.loadingPages.delete(page);
                return;
            }
            const load = ASCSeparator.createLoading(page);
            parsed.loading?.querySelector('.load').append(load);
            const pos = this.getPosicaoInsercao(page, parsed);
            let elLoad = pos?.elemento?.insertAdjacentElement(pos.metodo, parsed.loading);

            const separator = ASCSeparator.create( page, parsed.totalItems );
            parsed.separador.dataset.page = page;
            parsed.separador.querySelector('.conteudo_separador')?.append(separator);
            let pontoInsercao = elLoad.insertAdjacentElement(pos.metodo, parsed.separador);

            const htmlExistente = new Set([...document.body.querySelectorAll('*')].map(el => el.outerHTML));
            parsed?.itens?.forEach(item => {
                if(!htmlExistente.has(item.outerHTML)){
                    pontoInsercao.after(item);
                    pontoInsercao = item;
                    htmlExistente.add(item.outerHTML);
                }
            });
            this.loadedPages.set( page, { page, next: this.getNextPageFromDocument( response.html ?? response.document) } );
            this.observeLastItem();
            this.loadingPages.delete(page);
            this.saveState();
            elLoad.remove();
            this.scrollToPage(page);
            this.asc.setLog({ tipo: 'log', classe: 'ASCNavigator', texto: `Página ${page} carregada!` });
        }catch(error){
            this.loadingPages.delete(page);
            this.asc.setLog({ tipo: 'erro', classe: 'ASCNavigator', erro: `Erro ao carregar página: ${error.message}` });
        }
    }
    converterParaElementoHTML(htmlString) {
        const stringLimpa = String(htmlString).trim().toLowerCase();
        const div = document.createElement('div');
        let tagPai = 'div'; // Padrão caso não combine com nenhuma regra

        if (stringLimpa.startsWith('<tr') || stringLimpa.startsWith('<tbody') || stringLimpa.startsWith('<thead') || stringLimpa.startsWith('<td'))tagPai = 'table';// Detecta a tag filha e define o elemento pai correto
        else if (stringLimpa.startsWith('<li'))tagPai = 'ul'; // Como 'li' serve para 'ul' e 'ol', o padrão será 'ul'
        else if (stringLimpa.startsWith('<dt') || stringLimpa.startsWith('<dd'))tagPai = 'dl';
        else if (stringLimpa.startsWith('<ul') || stringLimpa.startsWith('<ol') || stringLimpa.startsWith('<table') || stringLimpa.startsWith('<dl')) { //se a string já tiver a tag pai na raiz, injeta direto na div
            div.innerHTML = htmlString;
            return div.firstElementChild;
        }
        div.innerHTML = `<${tagPai}>${htmlString}</${tagPai}>`;
        return div.firstElementChild;
    }
    contemHTML(string) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(string, 'text/html');
        // Verifica se o corpo gerado contém algum elemento filho (tags)
        return doc.body.childNodes.length > 0 && Array.from(doc.body.childNodes).some(node => node.nodeType === 1);
    }
    /**
    * Vai para página já carregada
    */
    scrollToPage(page){
        try{
            let block = this.loadedPages.get( page );
            if(!block)return;
            let goTo = document.querySelector(`.asc-page-separator[data-page="${block.page}"]`)
            if(goTo)goTo.scrollIntoView({ behavior:'smooth', block:'start' });
        }catch(error){
            this.asc.setLog({ tipo: 'erro', modulo: 'scrollToPage', erro: `Erro no mover ate item: ${error.message}` });
        }
    }
    getNextPageFromDocument(doc){
        if(typeof doc !== 'object' || !doc.querySelectorAll){
            const parser = new DOMParser();
            doc = parser.parseFromString( doc, 'text/html');
        }
        const links = [...doc.querySelectorAll('.pagination a')];
        const active = doc.querySelector('.pagination .active');
        if(active){
            const activeNumber = parseInt( active.textContent.trim() );
            for(const link of links){
                const number = parseInt( link.textContent.trim() );
                if( !isNaN(number) && number > activeNumber ){
                    try{
                        return Number( new URL(link.href).searchParams.get('page') );
                    }catch(e){}
                }
            }
        }
        const pages = [];
        links.forEach(link => {
            try{
                const page = Number( new URL(link.href).searchParams.get('page') );
                if(!isNaN(page))pages.push(page);
            }catch(e){}
        });
        if(!pages.length)return null;
        const current = Math.min(...pages);
        const next = current + 1;
        return pages.includes(next) ? next : null;
    }
    getLastRenderedItem(){
        switch(this.context.type){
            case 'table': return document.querySelector('table tbody tr:last-child');
            case 'list': return document.querySelector('#fancy-list-group > ul.list-group > li:last-child');
            case 'capa': {
                const cards = document.querySelectorAll('div.container_capas div.movie-card');
                return cards[cards.length - 1]?.parentElement;
            }
            case 'forum':{
                const comentarios = [...document.querySelectorAll('div.container-fluid > div > div.col-sm-10.col-md-10.col-lg-10.p-2.mb-5 > div:nth-child(2) > div.card-body .row')];
                return comentarios.pop() ?? null;
            }
            default: return null;
        }
    }
    observeLastItem(){
        const ultimo = this.getLastRenderedItem();
        if(!ultimo)return;
        if(this.currentObserved === ultimo)return;
        if(this.currentObserved) this.observer.unobserve(this.currentObserved);
        this.currentObserved = ultimo;
        this.observer.observe(ultimo);
    }
    startInfiniteScroll(){
        this.observer = new IntersectionObserver( async entries => {
            const entry = entries[0];
            if(!entry.isIntersecting)return;
            await this.loadNextPage();
        },{ root:null, rootMargin:'500px', threshold:0 });
        this.observeLastItem();
    }
    async loadNextPage(){
        const paginas = [...this.loadedPages.keys()].sort( (a,b) => a-b );
        const atual = paginas.at(-1);
        let info = this.loadedPages.get(atual);
        if(!info) info = { page:atual, next:null };
        let proxima = info.next;
        if(proxima == null){
            const response = await this.loader.load(this.urlManager.buildPageURL(atual));
            proxima = this.getNextPageFromDocument(response.html ?? response.document);
        }
        if(proxima == null)return;
        if(this.loadingPages.has(proxima))return;
        if(this.loadedPages.has(proxima))return;
        await this.loadPage(proxima);
    }
    loading( texto, tipo = 'alert-info', spinner = true ) {
        let status = document.getElementById('asc-status');
        if (!status) {
            status = document.createElement('div');
            status.id = 'asc-status';
            status.style.cssText = `position: fixed;bottom: 20px;right: 20px;z-index: 999999;min-width: 350px;
            max-width: 600px;box-shadow: 0 4px 12px rgba(0,0,0,.25);transition: all .3s ease;`;
            document.body.appendChild(status);
        }
        status.className = `alert ${tipo} mb-0`;
        const icone = spinner ? '<i class="fas fa-spinner fa-spin mr-2"></i>' : '';
        status.innerHTML = `<div class="d-flex align-items-center">${icone}<span>${texto}</span></div>`;
        status.style.display = 'block';
    }
    sucesso(texto) {
        this.loading( texto, 'alert-success', false );
        setTimeout(() => {
            const toast = document.getElementById('asc-status');
            if (toast)toast.remove();
        }, 4000);
    }
}

/**
 * ============================================================
 * Barra flutuante
 * ============================================================
 */
class ASCNavigatorFloatingBar {
    constructor(nav){
        this.nav = nav;
    }
    create(){
        if( document.getElementById('ascNavigatorBar') )return;
        const div = document.createElement('div');
        div.id = 'ascNavigatorBar';
        div.className = 'card shadow';
        div.style.cssText = `position:fixed;right:10px;bottom:60px;width:100px;z-index:99999;font-size:80%;`;
        div.innerHTML = `
        <div class="card-header">ASC Navigator</div>
        <div class="card-body">
            <input id="ascNavigatorPage" type="number" class="form-control form-control-sm mb-2"
                min="${this.nav.info.firstPage}"
                max="${this.nav.info.lastPage}"
            >
            <button class="btn btn-primary btn-block" id="ascNavigatorLoad" tite="Carregar Página">🔄</button>
        </div>
        `;
        document.body.appendChild(div);
        document.getElementById('ascNavigatorLoad').addEventListener('click', () => {
            const page = parseInt(document.getElementById('ascNavigatorPage').value);
            if( !isNaN(page) )this.nav.loadPage(page);
        });
    }
}

/**
 * ============================================================
 * Configurações
 * ============================================================
 */
class ASCNavigatorSettings {
    constructor(asc){
        this.asc = asc;
        this.cache = new ASCPageCache(asc);
    }
    open(){
        const config = this.cache.getConfig();
        const html = `
            <div class="container-fluid">
                <div class="form-group">
                    <label>Modo</label>
                    <select id="ascNavMode" class="form-control">
                        <option value="scroll" ${config.mode==='scroll' ? 'selected' : ''}>Scroll Infinito</option>
                        <option value="manual" ${config.mode==='manual' ? 'selected' : ''}>Seleção Manual</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Cache (Horas)</label>
                    <input id="ascNavCache" type="number" class="form-control" min="1" max="720"
                    value="${config.cache.expirationHours}">
                </div>
                <div class="custom-control custom-switch">
                    <input type="checkbox" class="custom-control-input" id="ascNavHidePagination"
                    ${config.hideOriginalPagination ? 'checked' : ''}>
                    <label class="custom-control-label" for="ascNavHidePagination">
                        Ocultar paginação original
                    </label>
                </div>
            </div>
        `;
        this.asc.ui.criarJanela({titulo: 'ASC Navigator', conteudo: html, onSave: () => { this.save() } });
    }
    save(){
        const config = this.cache.getConfig();
        config.mode = document.querySelector('#ascNavMode').value;
        config.cache.expirationHours = parseInt( document.querySelector('#ascNavCache').value );
        config.hideOriginalPagination = document.querySelector('#ascNavHidePagination').checked;
        this.cache.saveConfig(config);
        this.asc.setLog({ tipo: 'log', classe: 'ASCNavigatorSettings', texto: 'Configuração Navigator salva.' });
    }
}

class ASCNavigatorCacheManager {
    constructor(asc){
        this.asc = asc;
    }
    clear(confirm = true){
        try{
            if( confirm && !window.confirm('Deseja limpar todo o cache do Navigator?') )return;
            this.asc.db.navigator.cache = {};
            this.asc.db.navigator.state = {};
            this.asc.salvarBanco();
            this.asc.setLog({ tipo: 'sucesso', classe: 'ASCNavigatorCacheManager', texto:'Cache do Navigator removido.'});
        }catch(error){
            this.asc.setLog({ tipo: 'erro', classe: 'ASCNavigatorCacheManager', texto: error.message });
        }
    }
    stats(){
        const cache = this.asc.db.navigator.cache;
        const paginas = Object.keys(cache).length;
        let tamanho = 0;
        Object.values(cache).forEach( item => { tamanho += JSON.stringify(item).length; });
        return { paginas, tamanhoKB : (tamanho / 1024).toFixed(2) };
    }
}

class ASCNavigatorStats {
    constructor(asc){
        this.asc = asc;
        this.cache = new ASCNavigatorCacheManager(asc);
    }
    open(){
        const cache = this.cache;
        let html = `
        <div class="card-body">
            <ul class="list-group">
                <li class="list-group-item">
                    Páginas em cache: <strong><span>${cache.stats().paginas}</span></strong>
                </li>
                <li class="list-group-item">
                    Espaço utilizado: <strong><span>${cache.stats().tamanhoKB}</span> KB</strong>
                </li>
            </ul>
        </div>
        `;
        const modal = this.asc.ui.criarJanela({ id: 'asc-painel-dados-navegacao', titulo: `🎬 Navigator`, conteudo: html, class: 'asc-card-interface'});
        if(cache.stats().paginas > 0 && cache.stats().tamanhoKB){
            const limpar = document.createElement('button');
            limpar.className = 'btn btn-danger';
            limpar.innerHTML = '<i class="fas fa-trash-alt"></i> Limpar Dados';
            limpar.addEventListener('click', function() {
                cache.clear();
                const spans = modal.querySelectorAll('.list-group-item span');
                spans.forEach(span => { span.textContent = '0'; });
                this.remove();
            });
            const footer = modal.querySelector('.modal-footer');
            footer.insertBefore(limpar, footer.firstChild);
        }
    }
}


// =====================================================
// INITIALIZATION
// =====================================================

window.addEventListener('load', async () => {
    console.log(`%c${GM_info.script.name} %c[${GM_info.script.version}v]\n%c${GM_info.script.description} | Create by ${GM_info.script.author}`,'color: #347ab6;font-size:20px;','color: #347ab6;font-size:12px;','color: #4a4949;font-size:12px;');

    const api = new ASCPlus();
    const ui = new ASCInterface(api);
    const nv = new ASCNavigator(api);

    await ui.init();
    await nv.init();
});
