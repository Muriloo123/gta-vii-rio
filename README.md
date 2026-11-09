# GTA VII // Rio de Janeiro

Protótipo jogável em Three.js de uma cidade costeira inspirada no Rio de Janeiro. A área jogável se estende por cerca de 960 × 1.720 unidades, acompanhando a escala do mapa ilustrado, com bairros, ruas, parques e uma baía que separa Rio Vice de Netróit. A única travessia terrestre entre as cidades é uma ponte rodoviária que liga as ruas das duas margens, sobe sobre a baía e é sustentada por pilares e travessas de concreto. O Morro da Tijuca e o Cristo Redentor ficam na área marcada pelo jogador; a encosta acompanha o relevo para permitir caminhar por sua superfície, sem escadaria. Também é possível visitar a ilha do Pão de Açúcar e explorar as praias de Copacabana e da Tijuca.

## Rodar

Instale Node.js 18+ e, na raiz do projeto, execute:

```bash
npm install
npm run dev
```

Abra a URL mostrada pelo Vite. Também é possível abrir `index.html` diretamente em um navegador moderno com acesso à internet, pois o Three.js é carregado por CDN.

Ao abrir o jogo, a tela inicial apresenta a identidade original do projeto. Clique em `Iniciar novo jogo` para começar ou em `Continuar jogo` para carregar o progresso salvo. Durante a partida, o menu pausa o jogo e oferece abas para consultar o mapa e os controles.

## Controles

- `WASD` ou setas: mover
- `Shift`: correr
- `Enter`: entrar no carro/helicóptero próximo usando a animação de entrada; dentro do veículo, sair
- No carro: `W` acelera, `S` dá ré, `A` vira à esquerda e `D` vira à direita; as setas também funcionam. Arraste com o botão direito para controlar a câmera e use a roda do mouse para aproximar ou afastar
- `F` / `G`: alternar entre punhos e armas coletadas nos dois sentidos (`F` volta; `G` avança)
- No helicóptero: `WASD` voa na direção relativa à câmera; arraste com o botão direito para olhar ao redor; `↑` sobe e `↓` desce
- Perto do marcador amarelo: `E` entra e sai da Ammu-Rio; na loja, escolha Pistola 9mm, Sniper ou Escopeta para adicionar ao inventário e equipar
- `R`: reiniciar a posição

O relógio do jogo começa às 17:00 e avança um minuto por segundo real. O céu diurno fica azul, com sol e nuvens, das 06:00 às 17:59; das 18:00 às 05:59, fica escuro e estrelado, e as janelas dos prédios acendem. A loja Ammu-Rio tem fachada própria e um marcador amarelo de entrada, na localização do jogador registrada ao adicioná-la.

O mapa tem ruas em grade e bairros com rotatórias e ruas sem saída, representadas também no mapa local, que acompanha a área próxima ao jogador. Mais de cem carros de trânsito usam os sete modelos 3D incluídos (Renault Clio V6, Chevrolet Camaro SS 2009, McLaren 765LT, Ferrari 288 GTO, Tesla Roadster 2020, Mercedes-Benz 300 SL Gullwing e Fiat Uno Turbo I.E Mk2); as ruas, prédios e carros são omitidos na área reservada ao morro. Os prédios têm silhuetas e detalhes variados, como terraços, sacadas e caixas d'água. Prédios, paredes da Ammu-Rio e suportes da ponte têm colisão para bloquear a passagem do jogador e do carro. O Morro da Tijuca ocupa uma área delimitada, tem relevo caminhável e colisão por altura, com o Cristo Redentor no cume e sem escadaria. Um carro permanece parado no local depois que o jogador sai dele. O protótipo também inclui orla, mar, montanhas, palmeiras, câmera de terceira pessoa, HUD de missão, vida (inicialmente 100%) e saldo (inicialmente $00000000), uma pistola 9mm e uma escopeta flutuantes e giratórias para coletar, além de uma sniper low-poly original e um helicóptero SA342M Gazelle controlável. Na Ammu-Rio, é possível adicionar e equipar a Pistola 9mm, a Sniper ou a Escopeta. O helicóptero fica junto ao spawn da ponte Rio-Niterói, a 7,5 unidades do jogador, e pode ser acessado com `Enter`; a câmera acompanha a aeronave e pode ser girada ao arrastar com o botão direito do mouse. Ao dirigir, `W` acelera, `S` dá ré, `A` vira à esquerda e `D` vira à direita; o personagem desaparece, a câmera acompanha o carro e também pode ser controlada com o botão direito do mouse. Ao se aproximar de cada marcador, o jogador equipa a arma na mão e o HUD atualiza o item segurado.

## Créditos dos veículos

- Renault Clio V6: “2003 Renault Clio V6 Renault Sport”, de Ddiaz Design, [Sketchfab](https://sketchfab.com/3d-models/2003-renault-clio-v6-renault-sport-75ac0f329c3b4396906be58636581a10), licença [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Uso não comercial; adaptações devem manter a mesma licença.
- Chevrolet Camaro SS 2009: “Chevrolet Camaro SS 2009”, de andikapratamaw, [Sketchfab](https://sketchfab.com/3d-models/chevrolet-camaro-ss-2009-e0dc72a58f01413b8b9ba67e2bd09344), licença [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- McLaren 765LT: “Mclaren 765LT”, de Zain Jafar, [Sketchfab](https://sketchfab.com/3d-models/mclaren-765lt-3ec7192e747a4cad9e82c1681aef6112), licença [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Ferrari 288 GTO: “Ferrari 288 GTO”, de Randomness, [Sketchfab](https://sketchfab.com/3d-models/ferrari-288-gto-e83da098149746b5a3ba6f1661645b09), licença [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Tesla Roadster 2020: “Tesla Roadster 2020”, de metarex.4d, [Sketchfab](https://sketchfab.com/3d-models/tesla-roadster-2020-1fbf29e297bd4a17ac39a00a378441d8), licença [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Mercedes-Benz 300 SL Gullwing: de Lexyc16, [Sketchfab](https://sketchfab.com/3d-models/mercedes-benz-300-sl-gullwing-505241c829c540a4921533000736904e), licença [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Fiat Uno Turbo I.E Mk2: de boitaloran, [Sketchfab](https://sketchfab.com/3d-models/fiat-uno-turbo-ie-mk2-56df35ff788e4c2a8ca59fcec5fe7158), licença [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Escopeta: “Shotgun”, de MKoegler3D, [Sketchfab](https://sketchfab.com/3d-models/shotgun-bfbd8edb727846d89e25f797c202437f), licença [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Helicóptero SA342M Gazelle: de VTX, [Sketchfab](https://sketchfab.com/3d-models/sa342m-gazelle-2eb65cec2060459085ea4f06db44d668), licença [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Uso não comercial; adaptações devem manter a mesma licença.

Os arquivos de licença e atribuição originais também estão junto dos modelos em `public/assets/cars/`.
