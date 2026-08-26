# Carteira PAES V4.1 Online

Esta versão transforma a Carteira PAES em uma aplicação compartilhada no Netlify.

## O que já está incluído

- Login centralizado no banco: o mesmo usuário funciona em qualquer computador.
- Perfis: Desenvolvedor, Edição Bordo, Edição PMB e Visualização.
- Uma PAES compartilhada para todos os usuários.
- Sincronização econômica: o navegador verifica apenas a revisão a cada 15 segundos e baixa a PAES completa somente quando a revisão mudou.
- Salvamento online automático para usuários com permissão de edição.
- Cadastro de usuários pela aba Desenvolvedor usando o banco online.
- Histórico Fleg Aplat arquivado automaticamente todos os dias às 00:05 no horário de Brasília (03:05 UTC).
- Cache local continua ativo como contingência.

## Primeiro deploy

1. Crie um repositório privado no GitHub.
2. Descompacte este ZIP e envie **todo o conteúdo desta pasta** para a raiz do repositório.
3. No Netlify, escolha **Add new project / Import an existing project** e conecte esse repositório.
4. O `netlify.toml` já aponta:
   - pasta publicada: `public`
   - functions: `netlify/functions`
   - scheduled function: `archive-flags`
5. Antes do primeiro login, no Netlify abra:
   **Project configuration > Environment variables**
6. Crie a variável:
   - `PAES_HSA_INITIAL_PASSWORD`
   - valor inicial: `1234`
   - marque como secret, se a interface oferecer essa opção.
7. Faça um novo deploy depois de criar a variável.
8. Abra o endereço publicado e entre com:
   - Login: `HSA`
   - Senha: `1234`

No primeiro login, o usuário HSA é criado no banco como Desenvolvedor.

## Depois do primeiro acesso

Na aba **DESENVOLVEDOR**, cadastre os usuários de Edição Bordo, Edição PMB e Visualização. Como os cadastros ficam no banco, eles funcionarão em qualquer computador.

## Como colocar a PAES atual no banco

Entre como HSA, importe o Excel da PAES normalmente. A V4 envia o estado automaticamente para o servidor. Aguarde o indicador superior mostrar algo como:

`Online • rev. 1`

Depois, abra o mesmo endereço em outro navegador/computador e faça login. A mesma PAES deverá aparecer.

## Sincronização

Cada navegador consulta `/api/revision` a cada 15 segundos somente enquanto a página está visível.

- Se a revisão não mudou: resposta mínima.
- Se mudou: baixa `/api/state`.
- Ao editar: a V4 grava a nova revisão no servidor.

Se duas pessoas editarem exatamente ao mesmo tempo, o sistema detecta conflito de revisão e carrega a versão mais recente.

## Histórico Fleg Aplat

A função `archive-flags` está configurada para:

`5 3 * * *`

As Scheduled Functions do Netlify usam UTC, então 03:05 UTC corresponde a 00:05 no horário de Brasília (UTC-3). A função funciona mesmo se nenhum computador estiver ligado.

Ela arquiva os serviços flegados usando a **Data Prevista** e não limpa os flags atuais. O botão Apagar Flags continua sendo uma ação separada.

## Banco

A migration `netlify/database/migrations/001_initial.sql` cria:

- `paes_users`
- `paes_sessions`
- `paes_state`

A PAES compartilhada é armazenada como JSONB com um número de revisão.

## Segurança

- Senhas são armazenadas com `scrypt` + salt.
- Sessões usam tokens aleatórios; apenas o hash do token é salvo no banco.
- Sessões expiram em 12 horas.
- A aba Desenvolvedor continua exclusiva do perfil Desenvolvedor.
- Visualização não pode gravar no endpoint de estado.

Observação: nesta primeira V4, Edição Bordo e Edição PMB usam as restrições de campos da interface e o servidor também bloqueia usuários somente-leitura. A separação campo-a-campo no servidor pode ser endurecida numa próxima etapa, se necessário.

## Teste recomendado

Antes de liberar aos demais usuários:

1. HSA faz login.
2. Importa uma PAES de teste.
3. Altera um Status.
4. Abre outro navegador com usuário Visualização.
5. Confirma que a alteração aparece em até ~15 segundos.
6. Cria um usuário Bordo e outro PMB e testa as permissões.
7. Na página Functions do Netlify, abra `archive-flags` e use **Run now** uma vez para validar o arquivamento sem esperar meia-noite.


## Correção V4.1

Corrigida a rota de usuários para atender tanto `/api/users` (listar/criar) quanto `/api/users/*` (excluir).


## V4.1 — Troca obrigatória de senha

- Senha 1234 é tratada como temporária para usuários comuns.
- Opção para forçar troca no próximo login.
- Nova senha deve ter no mínimo 6 caracteres e não pode ser 1234.
- Migration 002 adiciona must_change_password.
