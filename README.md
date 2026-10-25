# Two Dice Hero Ledger

Quero um aplicartivo para um rpg com as seguintes carateriscticas, você deve armazenar as informações dos personagens e salvar indiviualdemnte cada atributo, que mandarei no estilo disco elysium, elas servirão pra rolar 2 d6 + pontos individuais pra cada skill secundaria, quero que salve armazenamento de armas com ficha de mohcila de cada jogador em seções separadas, AS SKILLS S^~AO AS SEGUINTES: faça todas subskills com pontos bases baseado na skill principal que posso adicionar mais pontos, deixe um espaçpo pra armazenar hogadores novos 𝑰𝒏𝒕𝒆𝒍𝒆𝒄𝒕𝒐: Lógica: Desmontar mentiras, achar furos em argumentos e montar o mundo de forma lógica Enciclopédia: Tudo que você decorou na vida. Datas, capitais, músicas, fatos inúteis que de repente se tornam úteis em certas situações Retórica: A arte de discutir. Debater, persuadir e fazer as pessoas acreditarem no que você está dizendo, mesmo as vezes sem ter razão Drama: Mentir, atuar e detectar mentiras. Conceptualização: Ver a arte nas coisas. Criatividade, entender conceitos abstratos e resolver enigmas Cálculo Visual: Reconstruir cenas na sua cabeça. Geometria, trajetórias, o que aconteceu aqui baseado nos vestígios.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://two-dice-hero-ledger.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/904c7edb-9191-43f2-b8ce-6e435799e00f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Celular da campanha

O saldo e as transferências são exibidos em rupias indonésias (IDR). O arquivo compartilhado de fotos, as notícias e a agenda de contatos usam as tabelas da migração [`0006_phone_apps_contacts.sql`](./drizzle/migrations/0006_phone_apps_contacts.sql); aplique o conteúdo desse arquivo no SQL Editor do projeto Supabase antes de publicar a versão do app. Sem essa migração, o celular continua abrindo e permite mensagens diretas, mas a agenda de contatos, notícias e galeria ficam indisponíveis. O webhook do Discord é opcional e fica salvo apenas no navegador do Mestre.
