# SELIC v4.2 — Treinamento (GitHub Pages)

## Publicar

1. Extraia o ZIP e envie **os arquivos da pasta**, incluindo `index.html`, à raiz de um repositório no GitHub.
2. No GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**.
3. Selecione `main` e `/ (root)` e salve.
4. Abra a URL disponibilizada em GitHub Pages.

## Como inicia

- Os **cinco setores começam sem processos**. As planilhas históricas não serão carregadas automaticamente.
- Ao abrir esta versão pela primeira vez em um navegador, a base de processos dessa origem é esvaziada **uma única vez**. Dados adicionados posteriormente pela importação administrativa não serão limpos na próxima visita.
- Os 16 pré-cadastros de pregoeiros ficam disponíveis para aprovação, desde que ainda não existam nessa origem.
- Para carregar novos processos, entre na Administração → Importar planilhas, escolha o setor e, no caso DIPREG, o pregoeiro.

## Limitações IMPORTANTES do GitHub Pages

Este pacote é **somente para demonstração e treinamento com dados fictícios ou públicos**. GitHub Pages hospeda arquivos estáticos; não executa um servidor de autenticação nem banco de dados.

- As contas, aprovações, senhas e processos ficam no **localStorage do navegador** e **não são sincronizados entre computadores**.
- A senha e a autenticação desta demo **não são seguras** para uso real; o código é público e pode ser inspecionado.
- Uma senha redefinida pelo administrador no computador A **não é automaticamente válida no computador B**. Isso não pode ser resolvido apenas com GitHub Pages.
- Não publique informações sigilosas, pessoais ou dados operacionais sensíveis.
- Para cadastro, redefinição de senha e acesso segregado reais, é indispensável uma API com autenticação segura, controle de acesso no servidor e banco de dados compartilhado.

## Nota

Se você já importou processos nesta mesma origem, a limpeza única da primeira execução remove os registros locais anteriores. Faça um backup antes de substituir a versão em uso.
