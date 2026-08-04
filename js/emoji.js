/*
==================================================
QRTalk 3.0
Seletor de emojis
==================================================
*/

"use strict";

(() => {
    /*
    ==================================================
    CONFIGURAÇÕES
    ==================================================
    */

    const MAX_RECENT_EMOJIS = 36;

    const DEFAULT_RECENT_EMOJIS = [
        "😀",
        "😂",
        "😍",
        "🥰",
        "😊",
        "😎",
        "🤔",
        "😭",
        "😡",
        "👍",
        "👏",
        "🙏",
        "❤️",
        "🔥",
        "🎉",
        "✅",
        "👀",
        "🚀"
    ];

    const SKIN_TONES = [
        {
            value: "",
            label: "Tom padrão",
            icon: "👋"
        },
        {
            value: "🏻",
            label: "Tom de pele claro",
            icon: "👋🏻"
        },
        {
            value: "🏼",
            label: "Tom de pele médio-claro",
            icon: "👋🏼"
        },
        {
            value: "🏽",
            label: "Tom de pele médio",
            icon: "👋🏽"
        },
        {
            value: "🏾",
            label: "Tom de pele médio-escuro",
            icon: "👋🏾"
        },
        {
            value: "🏿",
            label: "Tom de pele escuro",
            icon: "👋🏿"
        }
    ];

    const CATEGORY_CONFIG = [
        {
            id: "recent",
            icon: "🕘",
            title: "Recentes"
        },
        {
            id: "smileys",
            icon: "😀",
            title: "Rostos e emoções"
        },
        {
            id: "people",
            icon: "👋",
            title: "Pessoas e gestos"
        },
        {
            id: "animals",
            icon: "🐻",
            title: "Animais e natureza"
        },
        {
            id: "food",
            icon: "🍕",
            title: "Comidas e bebidas"
        },
        {
            id: "activities",
            icon: "⚽",
            title: "Atividades"
        },
        {
            id: "travel",
            icon: "🚗",
            title: "Viagens e lugares"
        },
        {
            id: "objects",
            icon: "💡",
            title: "Objetos"
        },
        {
            id: "symbols",
            icon: "❤️",
            title: "Símbolos"
        },
        {
            id: "flags",
            icon: "🏳️",
            title: "Bandeiras"
        }
    ];

    /*
    Cada item possui:

    emoji
    palavras usadas pela pesquisa
    */

    const EMOJI_CATEGORIES = {
        smileys: [
            ["😀", "feliz sorriso alegre rosto"],
            ["😃", "feliz sorriso aberto alegre"],
            ["😄", "feliz sorriso olhos alegria"],
            ["😁", "feliz sorriso dentes"],
            ["😆", "rir gargalhada feliz"],
            ["😅", "suor alívio sorriso"],
            ["🤣", "rolando rir gargalhada"],
            ["😂", "rindo lágrimas alegria"],
            ["🙂", "sorriso leve feliz"],
            ["🙃", "de cabeça para baixo ironia"],
            ["🫠", "derretendo calor vergonha"],
            ["😉", "piscando brincadeira"],
            ["😊", "feliz tímido sorriso"],
            ["😇", "anjo inocente auréola"],
            ["🥰", "apaixonado corações amor"],
            ["😍", "olhos coração apaixonado"],
            ["🤩", "estrela olhos impressionado"],
            ["😘", "beijo coração amor"],
            ["😗", "beijo"],
            ["☺️", "sorriso feliz"],
            ["😚", "beijo olhos fechados"],
            ["😙", "beijo sorrindo"],
            ["🥲", "sorriso lágrima emoção"],
            ["😋", "delicioso língua comida"],
            ["😛", "língua brincadeira"],
            ["😜", "piscando língua brincadeira"],
            ["🤪", "louco brincadeira"],
            ["😝", "língua olhos fechados"],
            ["🤑", "dinheiro rico"],
            ["🤗", "abraço carinho"],
            ["🤭", "mão boca surpresa risada"],
            ["🫢", "surpresa mão boca"],
            ["🫣", "espiando vergonha"],
            ["🤫", "silêncio segredo"],
            ["🤔", "pensando dúvida"],
            ["🫡", "saudação respeito"],
            ["🤐", "boca fechada segredo"],
            ["🤨", "desconfiado sobrancelha"],
            ["😐", "neutro sem expressão"],
            ["😑", "sem expressão"],
            ["😶", "sem boca silêncio"],
            ["🫥", "invisível pontilhado"],
            ["😶‍🌫️", "nuvens confuso escondido"],
            ["😏", "sorriso malicioso"],
            ["😒", "insatisfeito irritado"],
            ["🙄", "revirando olhos"],
            ["😬", "careta nervoso"],
            ["😮‍💨", "suspiro alívio cansaço"],
            ["🤥", "mentira nariz"],
            ["🫨", "tremendo choque"],
            ["🙂‍↔️", "negando não"],
            ["🙂‍↕️", "concordando sim"],
            ["😌", "aliviado tranquilo"],
            ["😔", "triste pensativo"],
            ["😪", "sono cansado"],
            ["🤤", "babando desejo"],
            ["😴", "dormindo sono"],
            ["😷", "máscara doente"],
            ["🤒", "febre doente termômetro"],
            ["🤕", "machucado curativo"],
            ["🤢", "enjoo doente"],
            ["🤮", "vomitando doente"],
            ["🤧", "espirrando resfriado"],
            ["🥵", "calor quente"],
            ["🥶", "frio congelando"],
            ["🥴", "tonto confuso"],
            ["😵", "tonto"],
            ["😵‍💫", "olhos espiral tonto"],
            ["🤯", "mente explodindo surpresa"],
            ["🤠", "cowboy chapéu"],
            ["🥳", "festa aniversário"],
            ["🥸", "disfarce óculos bigode"],
            ["😎", "óculos escuros legal"],
            ["🤓", "nerd óculos"],
            ["🧐", "monóculo investigando"],
            ["😕", "confuso"],
            ["🫤", "incerto descontente"],
            ["😟", "preocupado"],
            ["🙁", "triste leve"],
            ["☹️", "triste"],
            ["😮", "surpreso boca aberta"],
            ["😯", "surpreso"],
            ["😲", "chocado"],
            ["😳", "envergonhado surpreso"],
            ["🥺", "implorando olhos"],
            ["🥹", "segurando lágrimas emoção"],
            ["😦", "preocupado boca aberta"],
            ["😧", "angustiado"],
            ["😨", "medo"],
            ["😰", "ansioso suor"],
            ["😥", "triste alívio"],
            ["😢", "chorando lágrima"],
            ["😭", "chorando muito"],
            ["😱", "gritando medo"],
            ["😖", "confuso sofrimento"],
            ["😣", "persistindo sofrimento"],
            ["😞", "decepcionado"],
            ["😓", "suor triste"],
            ["😩", "cansado"],
            ["😫", "exausto"],
            ["🥱", "bocejando sono"],
            ["😤", "orgulhoso irritado"],
            ["😡", "bravo raiva"],
            ["😠", "irritado bravo"],
            ["🤬", "xingando palavrão raiva"],
            ["😈", "diabo sorriso"],
            ["👿", "diabo bravo"],
            ["💀", "caveira morte"],
            ["☠️", "caveira perigo"],
            ["💩", "cocô"],
            ["🤡", "palhaço"],
            ["👹", "monstro ogro"],
            ["👺", "monstro japonês"],
            ["👻", "fantasma"],
            ["👽", "alienígena"],
            ["👾", "invasor jogo"],
            ["🤖", "robô"],
            ["😺", "gato feliz"],
            ["😸", "gato sorrindo"],
            ["😹", "gato rindo lágrimas"],
            ["😻", "gato apaixonado"],
            ["😼", "gato malicioso"],
            ["😽", "gato beijo"],
            ["🙀", "gato surpreso"],
            ["😿", "gato chorando"],
            ["😾", "gato bravo"],
            ["🙈", "macaco não vê"],
            ["🙉", "macaco não ouve"],
            ["🙊", "macaco não fala"],
            ["💋", "beijo lábios"],
            ["💌", "carta amor"],
            ["💘", "coração flecha"],
            ["💝", "coração presente"],
            ["💖", "coração brilhante"],
            ["💗", "coração crescendo"],
            ["💓", "coração batendo"],
            ["💞", "corações girando"],
            ["💕", "dois corações"],
            ["💟", "decoração coração"],
            ["❣️", "exclamação coração"],
            ["💔", "coração partido"],
            ["❤️‍🔥", "coração fogo paixão"],
            ["❤️‍🩹", "coração curando"],
            ["❤️", "coração vermelho amor"],
            ["🩷", "coração rosa"],
            ["🧡", "coração laranja"],
            ["💛", "coração amarelo"],
            ["💚", "coração verde"],
            ["💙", "coração azul"],
            ["🩵", "coração azul claro"],
            ["💜", "coração roxo"],
            ["🤎", "coração marrom"],
            ["🖤", "coração preto"],
            ["🩶", "coração cinza"],
            ["🤍", "coração branco"]
        ],

        people: [
            ["👋", "aceno olá tchau mão"],
            ["🤚", "mão levantada"],
            ["🖐️", "mão aberta cinco"],
            ["✋", "pare mão"],
            ["🖖", "saudação vulcano"],
            ["🫱", "mão direita"],
            ["🫲", "mão esquerda"],
            ["🫳", "mão para baixo"],
            ["🫴", "mão para cima"],
            ["👌", "ok perfeito"],
            ["🤌", "dedos juntos italiano"],
            ["🤏", "pequeno pouco"],
            ["✌️", "paz vitória"],
            ["🤞", "dedos cruzados sorte"],
            ["🫰", "coração dedos dinheiro"],
            ["🤟", "eu te amo gesto"],
            ["🤘", "rock chifres"],
            ["🤙", "me liga"],
            ["👈", "apontando esquerda"],
            ["👉", "apontando direita"],
            ["👆", "apontando cima"],
            ["🖕", "dedo do meio"],
            ["👇", "apontando baixo"],
            ["☝️", "um atenção"],
            ["🫵", "apontando você"],
            ["👍", "curtir positivo aprovado"],
            ["👎", "não curtir negativo"],
            ["✊", "punho fechado"],
            ["👊", "soco"],
            ["🤛", "punho esquerda"],
            ["🤜", "punho direita"],
            ["👏", "palmas parabéns"],
            ["🙌", "mãos levantadas comemoração"],
            ["🫶", "mãos coração amor"],
            ["👐", "mãos abertas"],
            ["🤲", "mãos juntas recebendo"],
            ["🤝", "aperto de mãos acordo"],
            ["🙏", "oração obrigado por favor"],
            ["✍️", "escrevendo mão"],
            ["💅", "unhas manicure"],
            ["🤳", "selfie celular"],
            ["💪", "força músculo"],
            ["🦾", "braço mecânico"],
            ["🦿", "perna mecânica"],
            ["🦵", "perna"],
            ["🦶", "pé"],
            ["👂", "orelha ouvir"],
            ["👃", "nariz"],
            ["🧠", "cérebro inteligência"],
            ["🫀", "coração órgão"],
            ["🫁", "pulmões"],
            ["🦷", "dente"],
            ["🦴", "osso"],
            ["👀", "olhos olhando"],
            ["👁️", "olho"],
            ["👅", "língua"],
            ["👄", "boca lábios"],
            ["🫦", "mordendo lábio"],
            ["👶", "bebê"],
            ["🧒", "criança"],
            ["👦", "menino"],
            ["👧", "menina"],
            ["🧑", "pessoa adulto"],
            ["👱", "pessoa loira"],
            ["👨", "homem"],
            ["🧔", "pessoa barba"],
            ["👩", "mulher"],
            ["🧓", "pessoa idosa"],
            ["👴", "idoso avô"],
            ["👵", "idosa avó"],
            ["🙍", "pessoa triste"],
            ["🙎", "pessoa irritada"],
            ["🙅", "não gesto"],
            ["🙆", "ok gesto"],
            ["💁", "informação ajuda"],
            ["🙋", "mão levantada pessoa"],
            ["🧏", "pessoa surda"],
            ["🙇", "curvando respeito"],
            ["🤦", "mão no rosto"],
            ["🤷", "não sei ombros"],
            ["🧑‍⚕️", "profissional saúde médico"],
            ["🧑‍🎓", "estudante formando"],
            ["🧑‍🏫", "professor"],
            ["🧑‍⚖️", "juiz justiça"],
            ["🧑‍🌾", "agricultor"],
            ["🧑‍🍳", "cozinheiro chef"],
            ["🧑‍🔧", "mecânico"],
            ["🧑‍🏭", "operário fábrica"],
            ["🧑‍💼", "escritório trabalho"],
            ["🧑‍🔬", "cientista"],
            ["🧑‍💻", "programador computador"],
            ["🧑‍🎤", "cantor música"],
            ["🧑‍🎨", "artista"],
            ["🧑‍✈️", "piloto"],
            ["🧑‍🚀", "astronauta"],
            ["🧑‍🚒", "bombeiro"],
            ["👮", "policial"],
            ["🕵️", "detetive"],
            ["💂", "guarda"],
            ["🥷", "ninja"],
            ["👷", "construção trabalhador"],
            ["🫅", "pessoa coroa"],
            ["🤴", "príncipe"],
            ["👸", "princesa"],
            ["👳", "turbante"],
            ["👲", "chapéu"],
            ["🧕", "lenço cabeça"],
            ["🤵", "terno casamento"],
            ["👰", "noiva casamento"],
            ["🤰", "grávida"],
            ["🫃", "homem grávido"],
            ["🫄", "pessoa grávida"],
            ["🤱", "amamentando"],
            ["👼", "bebê anjo"],
            ["🎅", "papai noel natal"],
            ["🤶", "mamãe noel natal"],
            ["🧑‍🎄", "pessoa natal"],
            ["🦸", "super herói"],
            ["🦹", "vilão"],
            ["🧙", "mago"],
            ["🧚", "fada"],
            ["🧛", "vampiro"],
            ["🧜", "sereia"],
            ["🧝", "elfo"],
            ["🧞", "gênio"],
            ["🧟", "zumbi"],
            ["💆", "massagem"],
            ["💇", "corte cabelo"],
            ["🚶", "caminhando"],
            ["🧍", "em pé"],
            ["🧎", "ajoelhado"],
            ["🏃", "correndo"],
            ["💃", "dançando mulher"],
            ["🕺", "dançando homem"],
            ["🕴️", "pessoa terno levitando"],
            ["👯", "pessoas dançando"],
            ["🧖", "sauna"],
            ["🧗", "escalando"],
            ["🤺", "esgrima"],
            ["🏇", "cavalo corrida"],
            ["⛷️", "esqui"],
            ["🏂", "snowboard"],
            ["🏌️", "golfe"],
            ["🏄", "surfe"],
            ["🚣", "remo"],
            ["🏊", "natação"],
            ["⛹️", "bola esporte"],
            ["🏋️", "levantamento peso"],
            ["🚴", "bicicleta"],
            ["🚵", "mountain bike"],
            ["🤸", "ginástica"],
            ["🤼", "luta"],
            ["🤽", "polo aquático"],
            ["🤾", "handebol"],
            ["🤹", "malabarismo"],
            ["🧘", "meditação yoga"],
            ["🛀", "banho"],
            ["🛌", "dormindo cama"],
            ["🧑‍🤝‍🧑", "pessoas de mãos dadas"],
            ["👭", "duas mulheres"],
            ["👫", "mulher homem"],
            ["👬", "dois homens"],
            ["💏", "beijo casal"],
            ["💑", "casal coração"],
            ["👪", "família"],
            ["🗣️", "falando voz"],
            ["👤", "pessoa silhueta"],
            ["👥", "pessoas silhueta"],
            ["🫂", "abraço pessoas"]
        ],

        animals: [
            ["🐵", "macaco rosto"],
            ["🐒", "macaco"],
            ["🦍", "gorila"],
            ["🦧", "orangotango"],
            ["🐶", "cachorro cão rosto"],
            ["🐕", "cachorro cão"],
            ["🦮", "cão guia"],
            ["🐕‍🦺", "cão serviço"],
            ["🐩", "poodle"],
            ["🐺", "lobo"],
            ["🦊", "raposa"],
            ["🦝", "guaxinim"],
            ["🐱", "gato rosto"],
            ["🐈", "gato"],
            ["🐈‍⬛", "gato preto"],
            ["🦁", "leão"],
            ["🐯", "tigre rosto"],
            ["🐅", "tigre"],
            ["🐆", "leopardo"],
            ["🐴", "cavalo rosto"],
            ["🫎", "alce"],
            ["🫏", "burro"],
            ["🐎", "cavalo"],
            ["🦄", "unicórnio"],
            ["🦓", "zebra"],
            ["🦌", "veado"],
            ["🦬", "bisão"],
            ["🐮", "vaca rosto"],
            ["🐂", "boi"],
            ["🐃", "búfalo"],
            ["🐄", "vaca"],
            ["🐷", "porco rosto"],
            ["🐖", "porco"],
            ["🐗", "javali"],
            ["🐽", "focinho porco"],
            ["🐏", "carneiro"],
            ["🐑", "ovelha"],
            ["🐐", "cabra"],
            ["🐪", "camelo"],
            ["🐫", "camelo duas corcovas"],
            ["🦙", "lhama"],
            ["🦒", "girafa"],
            ["🐘", "elefante"],
            ["🦣", "mamute"],
            ["🦏", "rinoceronte"],
            ["🦛", "hipopótamo"],
            ["🐭", "rato rosto"],
            ["🐁", "rato"],
            ["🐀", "ratazana"],
            ["🐹", "hamster"],
            ["🐰", "coelho rosto"],
            ["🐇", "coelho"],
            ["🐿️", "esquilo"],
            ["🦫", "castor"],
            ["🦔", "ouriço"],
            ["🦇", "morcego"],
            ["🐻", "urso"],
            ["🐻‍❄️", "urso polar"],
            ["🐨", "coala"],
            ["🐼", "panda"],
            ["🦥", "preguiça animal"],
            ["🦦", "lontra"],
            ["🦨", "gambá"],
            ["🦘", "canguru"],
            ["🦡", "texugo"],
            ["🐾", "patas pegadas"],
            ["🦃", "peru"],
            ["🐔", "galinha"],
            ["🐓", "galo"],
            ["🐣", "pintinho nascendo"],
            ["🐤", "pintinho"],
            ["🐥", "pintinho frente"],
            ["🐦", "pássaro"],
            ["🐧", "pinguim"],
            ["🕊️", "pomba paz"],
            ["🦅", "águia"],
            ["🦆", "pato"],
            ["🦢", "cisne"],
            ["🦉", "coruja"],
            ["🦤", "dodô"],
            ["🪶", "pena"],
            ["🦩", "flamingo"],
            ["🦚", "pavão"],
            ["🦜", "papagaio"],
            ["🪽", "asa"],
            ["🐦‍⬛", "pássaro preto"],
            ["🪿", "ganso"],
            ["🐦‍🔥", "fênix fogo"],
            ["🐸", "sapo"],
            ["🐊", "crocodilo"],
            ["🐢", "tartaruga"],
            ["🦎", "lagarto"],
            ["🐍", "cobra"],
            ["🐲", "dragão rosto"],
            ["🐉", "dragão"],
            ["🦕", "dinossauro saurópode"],
            ["🦖", "tiranossauro"],
            ["🐳", "baleia"],
            ["🐋", "baleia grande"],
            ["🐬", "golfinho"],
            ["🦭", "foca"],
            ["🐟", "peixe"],
            ["🐠", "peixe tropical"],
            ["🐡", "baiacu"],
            ["🦈", "tubarão"],
            ["🐙", "polvo"],
            ["🐚", "concha"],
            ["🪸", "coral"],
            ["🪼", "água viva"],
            ["🐌", "caracol"],
            ["🦋", "borboleta"],
            ["🐛", "lagarta"],
            ["🐜", "formiga"],
            ["🐝", "abelha"],
            ["🪲", "besouro"],
            ["🐞", "joaninha"],
            ["🦗", "grilo"],
            ["🪳", "barata"],
            ["🕷️", "aranha"],
            ["🕸️", "teia aranha"],
            ["🦂", "escorpião"],
            ["🦟", "mosquito"],
            ["🪰", "mosca"],
            ["🪱", "minhoca"],
            ["🦠", "micróbio vírus"],
            ["💐", "buquê flores"],
            ["🌸", "flor cerejeira"],
            ["💮", "flor branca"],
            ["🪷", "lótus"],
            ["🏵️", "roseta"],
            ["🌹", "rosa"],
            ["🥀", "flor murcha"],
            ["🌺", "hibisco"],
            ["🌻", "girassol"],
            ["🌼", "flor"],
            ["🌷", "tulipa"],
            ["🪻", "jacinto"],
            ["🌱", "muda planta"],
            ["🪴", "planta vaso"],
            ["🌲", "pinheiro"],
            ["🌳", "árvore"],
            ["🌴", "palmeira"],
            ["🌵", "cacto"],
            ["🌾", "arroz planta"],
            ["🌿", "erva folha"],
            ["☘️", "trevo"],
            ["🍀", "trevo quatro folhas sorte"],
            ["🍁", "folha bordo"],
            ["🍂", "folhas caindo"],
            ["🍃", "folha vento"],
            ["🍄", "cogumelo"],
            ["🪨", "pedra"],
            ["🪵", "madeira"]
        ],

        food: [
            ["🍏", "maçã verde fruta"],
            ["🍎", "maçã vermelha fruta"],
            ["🍐", "pera fruta"],
            ["🍊", "laranja mexerica fruta"],
            ["🍋", "limão fruta"],
            ["🍋‍🟩", "limão verde"],
            ["🍌", "banana fruta"],
            ["🍉", "melancia fruta"],
            ["🍇", "uva fruta"],
            ["🍓", "morango fruta"],
            ["🫐", "mirtilo fruta"],
            ["🍈", "melão fruta"],
            ["🍒", "cereja fruta"],
            ["🍑", "pêssego fruta"],
            ["🥭", "manga fruta"],
            ["🍍", "abacaxi fruta"],
            ["🥥", "coco fruta"],
            ["🥝", "kiwi fruta"],
            ["🍅", "tomate"],
            ["🍆", "berinjela"],
            ["🥑", "abacate"],
            ["🫛", "ervilha"],
            ["🥦", "brócolis"],
            ["🥬", "folhas verdura"],
            ["🥒", "pepino"],
            ["🌶️", "pimenta"],
            ["🫑", "pimentão"],
            ["🌽", "milho"],
            ["🥕", "cenoura"],
            ["🫒", "azeitona"],
            ["🧄", "alho"],
            ["🧅", "cebola"],
            ["🥔", "batata"],
            ["🍠", "batata doce"],
            ["🫚", "gengibre"],
            ["🥐", "croissant pão"],
            ["🥯", "bagel pão"],
            ["🍞", "pão"],
            ["🥖", "baguete pão"],
            ["🫓", "pão sírio"],
            ["🥨", "pretzel"],
            ["🧀", "queijo"],
            ["🥚", "ovo"],
            ["🍳", "ovo frito frigideira"],
            ["🧈", "manteiga"],
            ["🥞", "panqueca"],
            ["🧇", "waffle"],
            ["🥓", "bacon"],
            ["🥩", "carne bife"],
            ["🍗", "frango coxa"],
            ["🍖", "carne osso"],
            ["🦴", "osso"],
            ["🌭", "cachorro quente hot dog"],
            ["🍔", "hambúrguer lanche"],
            ["🍟", "batata frita"],
            ["🍕", "pizza"],
            ["🫔", "tamale"],
            ["🌮", "taco"],
            ["🌯", "burrito"],
            ["🥙", "pão recheado"],
            ["🧆", "falafel"],
            ["🥪", "sanduíche"],
            ["🥫", "enlatado"],
            ["🍝", "macarrão espaguete"],
            ["🍜", "lámen sopa"],
            ["🍲", "ensopado panela"],
            ["🍛", "arroz curry"],
            ["🍣", "sushi"],
            ["🍱", "bentô"],
            ["🥟", "bolinho recheado"],
            ["🦪", "ostra"],
            ["🍤", "camarão frito"],
            ["🍙", "bolinho arroz"],
            ["🍚", "arroz"],
            ["🍘", "biscoito arroz"],
            ["🍥", "bolinho peixe"],
            ["🥠", "biscoito sorte"],
            ["🥮", "bolo lua"],
            ["🍢", "espetinho"],
            ["🍡", "dango doce"],
            ["🍧", "gelo raspado"],
            ["🍨", "sorvete"],
            ["🍦", "sorvete casquinha"],
            ["🥧", "torta"],
            ["🧁", "cupcake"],
            ["🍰", "bolo fatia"],
            ["🎂", "bolo aniversário"],
            ["🍮", "pudim"],
            ["🍭", "pirulito"],
            ["🍬", "bala doce"],
            ["🍫", "chocolate"],
            ["🍿", "pipoca"],
            ["🍩", "rosquinha donut"],
            ["🍪", "biscoito cookie"],
            ["🌰", "castanha"],
            ["🥜", "amendoim"],
            ["🍯", "mel"],
            ["🥛", "leite"],
            ["🍼", "mamadeira"],
            ["🫖", "bule chá"],
            ["☕", "café bebida quente"],
            ["🍵", "chá"],
            ["🧃", "suco caixinha"],
            ["🥤", "refrigerante copo"],
            ["🧋", "chá bolhas"],
            ["🍶", "saquê"],
            ["🍺", "cerveja"],
            ["🍻", "cervejas brinde"],
            ["🥂", "taças brinde"],
            ["🍷", "vinho taça"],
            ["🥃", "whisky copo"],
            ["🍸", "coquetel"],
            ["🍹", "bebida tropical"],
            ["🧉", "chimarrão mate"],
            ["🍾", "champanhe"],
            ["🧊", "gelo"],
            ["🥄", "colher"],
            ["🍴", "garfo faca"],
            ["🍽️", "prato talheres"],
            ["🥣", "tigela"],
            ["🥡", "caixa comida"],
            ["🥢", "hashi palitos"],
            ["🧂", "sal"]
        ],

        activities: [
            ["⚽", "futebol bola"],
            ["🏀", "basquete bola"],
            ["🏈", "futebol americano"],
            ["⚾", "beisebol"],
            ["🥎", "softbol"],
            ["🎾", "tênis bola"],
            ["🏐", "vôlei bola"],
            ["🏉", "rúgbi"],
            ["🥏", "frisbee disco"],
            ["🎱", "sinuca bilhar"],
            ["🪀", "ioiô brinquedo"],
            ["🏓", "ping pong tênis mesa"],
            ["🏸", "badminton"],
            ["🏒", "hóquei gelo"],
            ["🏑", "hóquei campo"],
            ["🥍", "lacrosse"],
            ["🏏", "críquete"],
            ["🪃", "bumerangue"],
            ["🥅", "gol rede"],
            ["⛳", "golfe buraco"],
            ["🪁", "pipa"],
            ["🏹", "arco flecha"],
            ["🎣", "pesca vara"],
            ["🤿", "mergulho máscara"],
            ["🥊", "boxe luva"],
            ["🥋", "artes marciais"],
            ["🎽", "camiseta corrida"],
            ["🛹", "skate"],
            ["🛼", "patins"],
            ["🛷", "trenó"],
            ["⛸️", "patinação gelo"],
            ["🥌", "curling"],
            ["🎿", "esqui"],
            ["⛷️", "esquiador"],
            ["🏂", "snowboard"],
            ["🪂", "paraquedas"],
            ["🏋️", "levantamento peso"],
            ["🤼", "luta"],
            ["🤸", "ginástica"],
            ["⛹️", "jogando bola"],
            ["🤺", "esgrima"],
            ["🤾", "handebol"],
            ["🏌️", "golfe pessoa"],
            ["🏇", "corrida cavalo"],
            ["🧘", "meditação yoga"],
            ["🏄", "surfe"],
            ["🏊", "natação"],
            ["🤽", "polo aquático"],
            ["🚣", "remo"],
            ["🧗", "escalada"],
            ["🚴", "ciclismo"],
            ["🚵", "ciclismo montanha"],
            ["🏆", "troféu campeão"],
            ["🥇", "medalha ouro primeiro"],
            ["🥈", "medalha prata segundo"],
            ["🥉", "medalha bronze terceiro"],
            ["🏅", "medalha esporte"],
            ["🎖️", "medalha militar"],
            ["🏵️", "roseta prêmio"],
            ["🎗️", "laço lembrete"],
            ["🎫", "ingresso"],
            ["🎟️", "ingressos"],
            ["🎪", "circo"],
            ["🤹", "malabarismo"],
            ["🎭", "teatro máscaras"],
            ["🩰", "balé sapatilha"],
            ["🎨", "arte pintura"],
            ["🎬", "cinema filme"],
            ["🎤", "microfone cantar"],
            ["🎧", "fone música"],
            ["🎼", "partitura música"],
            ["🎹", "piano teclado"],
            ["🥁", "bateria tambor"],
            ["🪘", "tambor"],
            ["🎷", "saxofone"],
            ["🎺", "trompete"],
            ["🪗", "acordeão"],
            ["🎸", "guitarra violão"],
            ["🪕", "banjo"],
            ["🎻", "violino"],
            ["🪈", "flauta"],
            ["🎲", "dado jogo"],
            ["♟️", "xadrez"],
            ["🎯", "alvo dardo"],
            ["🎳", "boliche"],
            ["🎮", "videogame controle"],
            ["🎰", "máquina caça níquel"],
            ["🧩", "quebra cabeça"],
            ["🃏", "carta curinga"],
            ["🀄", "mahjong"],
            ["🎴", "cartas japonesas"]
        ],

        travel: [
            ["🚗", "carro automóvel"],
            ["🚕", "táxi"],
            ["🚙", "suv carro"],
            ["🚌", "ônibus"],
            ["🚎", "trólebus"],
            ["🏎️", "carro corrida"],
            ["🚓", "carro polícia"],
            ["🚑", "ambulância"],
            ["🚒", "caminhão bombeiro"],
            ["🚐", "van"],
            ["🛻", "picape"],
            ["🚚", "caminhão entrega"],
            ["🚛", "caminhão carreta"],
            ["🚜", "trator"],
            ["🦯", "bengala"],
            ["🦽", "cadeira rodas manual"],
            ["🦼", "cadeira rodas motorizada"],
            ["🛴", "patinete"],
            ["🚲", "bicicleta"],
            ["🛵", "motoneta scooter"],
            ["🏍️", "moto motocicleta"],
            ["🛺", "tuk tuk"],
            ["🚨", "sirene polícia"],
            ["🚔", "polícia frente"],
            ["🚍", "ônibus frente"],
            ["🚘", "carro frente"],
            ["🚖", "táxi frente"],
            ["🚡", "teleférico"],
            ["🚠", "teleférico montanha"],
            ["🚟", "trem suspenso"],
            ["🚃", "vagão trem"],
            ["🚋", "bonde"],
            ["🚞", "trem montanha"],
            ["🚝", "monotrilho"],
            ["🚄", "trem rápido"],
            ["🚅", "trem bala"],
            ["🚈", "metrô leve"],
            ["🚂", "locomotiva"],
            ["🚆", "trem"],
            ["🚇", "metrô"],
            ["🚊", "bonde"],
            ["🚉", "estação"],
            ["✈️", "avião"],
            ["🛫", "avião decolando"],
            ["🛬", "avião pousando"],
            ["🛩️", "avião pequeno"],
            ["💺", "assento"],
            ["🛰️", "satélite"],
            ["🚀", "foguete espaço"],
            ["🛸", "disco voador"],
            ["🚁", "helicóptero"],
            ["🛶", "canoa"],
            ["⛵", "barco vela"],
            ["🚤", "lancha"],
            ["🛥️", "barco motor"],
            ["🛳️", "navio passageiros"],
            ["⛴️", "balsa"],
            ["🚢", "navio"],
            ["⚓", "âncora"],
            ["🛟", "boia salva vidas"],
            ["⛽", "posto combustível"],
            ["🚧", "obra barreira"],
            ["🚦", "semáforo vertical"],
            ["🚥", "semáforo horizontal"],
            ["🗺️", "mapa mundo"],
            ["🗿", "moai estátua"],
            ["🗽", "estátua liberdade"],
            ["🗼", "torre"],
            ["🏰", "castelo europeu"],
            ["🏯", "castelo japonês"],
            ["🏟️", "estádio"],
            ["🎡", "roda gigante"],
            ["🎢", "montanha russa"],
            ["🎠", "carrossel"],
            ["⛲", "fonte"],
            ["⛱️", "guarda sol praia"],
            ["🏖️", "praia"],
            ["🏝️", "ilha"],
            ["🏜️", "deserto"],
            ["🌋", "vulcão"],
            ["⛰️", "montanha"],
            ["🏔️", "montanha neve"],
            ["🗻", "monte fuji"],
            ["🏕️", "acampamento"],
            ["⛺", "barraca camping"],
            ["🛖", "cabana"],
            ["🏠", "casa"],
            ["🏡", "casa jardim"],
            ["🏘️", "casas"],
            ["🏚️", "casa abandonada"],
            ["🏗️", "construção"],
            ["🏭", "fábrica"],
            ["🏢", "prédio escritório"],
            ["🏬", "loja departamento"],
            ["🏣", "correio japonês"],
            ["🏤", "correio"],
            ["🏥", "hospital"],
            ["🏦", "banco"],
            ["🏨", "hotel"],
            ["🏪", "loja conveniência"],
            ["🏫", "escola"],
            ["🏩", "hotel amor"],
            ["💒", "casamento igreja"],
            ["🏛️", "prédio clássico"],
            ["⛪", "igreja"],
            ["🕌", "mesquita"],
            ["🛕", "templo hindu"],
            ["🕍", "sinagoga"],
            ["⛩️", "santuário"],
            ["🕋", "caaba"],
            ["🌅", "nascer sol"],
            ["🌄", "nascer sol montanha"],
            ["🏙️", "cidade"],
            ["🌆", "cidade entardecer"],
            ["🌇", "pôr do sol cidade"],
            ["🌉", "ponte noite"],
            ["♨️", "fontes termais"],
            ["🎑", "lua contemplação"],
            ["🏞️", "parque nacional"],
            ["🌌", "via láctea"],
            ["🌠", "estrela cadente"],
            ["🎇", "fogos"],
            ["🎆", "fogos artifício"]
        ],

        objects: [
            ["⌚", "relógio pulso"],
            ["📱", "celular telefone"],
            ["📲", "celular seta"],
            ["💻", "notebook computador"],
            ["⌨️", "teclado"],
            ["🖥️", "monitor computador"],
            ["🖨️", "impressora"],
            ["🖱️", "mouse computador"],
            ["🖲️", "trackball"],
            ["🕹️", "joystick jogo"],
            ["🗜️", "grampo ferramenta"],
            ["💽", "disco computador"],
            ["💾", "disquete salvar"],
            ["💿", "cd disco"],
            ["📀", "dvd disco"],
            ["📼", "fita vídeo"],
            ["📷", "câmera foto"],
            ["📸", "câmera flash"],
            ["📹", "câmera vídeo"],
            ["🎥", "filmadora cinema"],
            ["📽️", "projetor filme"],
            ["🎞️", "filme rolo"],
            ["📞", "telefone receptor"],
            ["☎️", "telefone"],
            ["📟", "pager"],
            ["📠", "fax"],
            ["📺", "televisão tv"],
            ["📻", "rádio"],
            ["🎙️", "microfone estúdio"],
            ["🎚️", "controle nível"],
            ["🎛️", "botões controle"],
            ["🧭", "bússola"],
            ["⏱️", "cronômetro"],
            ["⏲️", "temporizador"],
            ["⏰", "despertador"],
            ["🕰️", "relógio mesa"],
            ["⌛", "ampulheta"],
            ["⏳", "ampulheta correndo"],
            ["📡", "antena satélite"],
            ["🔋", "bateria"],
            ["🪫", "bateria fraca"],
            ["🔌", "tomada plugue"],
            ["💡", "lâmpada ideia"],
            ["🔦", "lanterna"],
            ["🕯️", "vela"],
            ["🪔", "lamparina"],
            ["🧯", "extintor"],
            ["🛢️", "barril óleo"],
            ["💸", "dinheiro voando"],
            ["💵", "dólar dinheiro"],
            ["💴", "iene dinheiro"],
            ["💶", "euro dinheiro"],
            ["💷", "libra dinheiro"],
            ["🪙", "moeda"],
            ["💰", "saco dinheiro"],
            ["💳", "cartão crédito"],
            ["💎", "diamante"],
            ["⚖️", "balança justiça"],
            ["🪜", "escada"],
            ["🧰", "caixa ferramentas"],
            ["🪛", "chave fenda"],
            ["🔧", "chave ferramenta"],
            ["🔨", "martelo"],
            ["⚒️", "martelo picareta"],
            ["🛠️", "ferramentas"],
            ["⛏️", "picareta"],
            ["🪚", "serrote"],
            ["🔩", "parafuso porca"],
            ["⚙️", "engrenagem"],
            ["🪤", "ratoeira"],
            ["🧱", "tijolo"],
            ["⛓️", "correntes"],
            ["🧲", "ímã"],
            ["🔫", "pistola água brinquedo"],
            ["💣", "bomba"],
            ["🧨", "explosivo fogos"],
            ["🪓", "machado"],
            ["🔪", "faca cozinha"],
            ["🗡️", "adaga"],
            ["⚔️", "espadas"],
            ["🛡️", "escudo"],
            ["🚬", "cigarro"],
            ["⚰️", "caixão"],
            ["🪦", "lápide"],
            ["⚱️", "urna"],
            ["🏺", "ânfora vaso"],
            ["🔮", "bola cristal"],
            ["📿", "contas oração"],
            ["🧿", "olho turco"],
            ["🪬", "amuleto"],
            ["💈", "barbearia"],
            ["⚗️", "alambique química"],
            ["🔭", "telescópio"],
            ["🔬", "microscópio"],
            ["🕳️", "buraco"],
            ["🩹", "curativo"],
            ["🩺", "estetoscópio"],
            ["🩻", "raio x"],
            ["🩼", "muleta"],
            ["💊", "remédio cápsula"],
            ["💉", "seringa vacina"],
            ["🩸", "gota sangue"],
            ["🧬", "dna genética"],
            ["🦠", "vírus micróbio"],
            ["🧫", "placa petri"],
            ["🧪", "tubo ensaio"],
            ["🌡️", "termômetro"],
            ["🧹", "vassoura"],
            ["🪠", "desentupidor"],
            ["🧺", "cesto"],
            ["🧻", "papel higiênico"],
            ["🚽", "vaso sanitário"],
            ["🚿", "chuveiro"],
            ["🛁", "banheira"],
            ["🧼", "sabão"],
            ["🪥", "escova dentes"],
            ["🪒", "barbeador"],
            ["🧽", "esponja"],
            ["🪣", "balde"],
            ["🧴", "frasco"],
            ["🔑", "chave"],
            ["🗝️", "chave antiga"],
            ["🚪", "porta"],
            ["🪑", "cadeira"],
            ["🛋️", "sofá"],
            ["🛏️", "cama"],
            ["🪞", "espelho"],
            ["🪟", "janela"],
            ["🧸", "urso pelúcia"],
            ["🪆", "boneca russa"],
            ["🖼️", "quadro imagem"],
            ["🛍️", "sacolas compras"],
            ["🛒", "carrinho compras"],
            ["🎁", "presente"],
            ["🎈", "balão festa"],
            ["🎏", "bandeira carpa"],
            ["🎀", "laço"],
            ["🪄", "varinha mágica"],
            ["🪅", "pinhata"],
            ["🎊", "confete"],
            ["🎉", "festa comemoração"],
            ["🎎", "bonecas japonesas"],
            ["🏮", "lanterna japonesa"],
            ["🎐", "sino vento"],
            ["🧧", "envelope vermelho"],
            ["✉️", "envelope carta"],
            ["📩", "envelope seta"],
            ["📨", "correspondência recebida"],
            ["📧", "email"],
            ["💌", "carta amor"],
            ["📥", "caixa entrada"],
            ["📤", "caixa saída"],
            ["📦", "pacote caixa"],
            ["🏷️", "etiqueta"],
            ["🪧", "placa"],
            ["📪", "caixa correio fechada"],
            ["📫", "caixa correio"],
            ["📬", "caixa correio aberta"],
            ["📭", "caixa correio vazia"],
            ["📮", "caixa postal"],
            ["📯", "corneta postal"],
            ["📜", "pergaminho"],
            ["📃", "página"],
            ["📄", "documento"],
            ["📑", "marcadores"],
            ["🧾", "recibo"],
            ["📊", "gráfico barras"],
            ["📈", "gráfico subindo"],
            ["📉", "gráfico descendo"],
            ["🗒️", "bloco notas"],
            ["🗓️", "calendário espiral"],
            ["📆", "calendário"],
            ["📅", "data calendário"],
            ["🗑️", "lixeira"],
            ["📇", "fichário"],
            ["🗃️", "caixa arquivo"],
            ["🗳️", "urna voto"],
            ["🗄️", "arquivo gaveta"],
            ["📋", "prancheta"],
            ["📁", "pasta"],
            ["📂", "pasta aberta"],
            ["🗂️", "divisórias"],
            ["🗞️", "jornal enrolado"],
            ["📰", "jornal"],
            ["📓", "caderno"],
            ["📔", "caderno decorado"],
            ["📒", "livro razão"],
            ["📕", "livro vermelho"],
            ["📗", "livro verde"],
            ["📘", "livro azul"],
            ["📙", "livro laranja"],
            ["📚", "livros"],
            ["📖", "livro aberto"],
            ["🔖", "marcador livro"],
            ["🧷", "alfinete segurança"],
            ["🔗", "link corrente"],
            ["📎", "clipe"],
            ["🖇️", "clipes"],
            ["📐", "régua triangular"],
            ["📏", "régua"],
            ["🧮", "ábaco"],
            ["📌", "alfinete"],
            ["📍", "marcador localização"],
            ["✂️", "tesoura"],
            ["🖊️", "caneta"],
            ["🖋️", "caneta tinteiro"],
            ["✒️", "ponta caneta"],
            ["🖌️", "pincel"],
            ["🖍️", "giz cera"],
            ["📝", "anotação lápis"],
            ["✏️", "lápis"],
            ["🔍", "lupa esquerda"],
            ["🔎", "lupa direita"],
            ["🔏", "cadeado caneta"],
            ["🔐", "cadeado chave"],
            ["🔒", "cadeado fechado"],
            ["🔓", "cadeado aberto"]
        ],

        symbols: [
            ["❤️", "amor coração vermelho"],
            ["🩷", "coração rosa"],
            ["🧡", "coração laranja"],
            ["💛", "coração amarelo"],
            ["💚", "coração verde"],
            ["💙", "coração azul"],
            ["🩵", "coração azul claro"],
            ["💜", "coração roxo"],
            ["🤎", "coração marrom"],
            ["🖤", "coração preto"],
            ["🩶", "coração cinza"],
            ["🤍", "coração branco"],
            ["💔", "coração partido"],
            ["❣️", "coração exclamação"],
            ["💕", "dois corações"],
            ["💞", "corações girando"],
            ["💓", "coração batendo"],
            ["💗", "coração crescendo"],
            ["💖", "coração brilhante"],
            ["💘", "coração flecha"],
            ["💝", "coração presente"],
            ["💟", "decoração coração"],
            ["☮️", "paz"],
            ["✝️", "cruz cristã"],
            ["☪️", "islã crescente"],
            ["🕉️", "om hindu"],
            ["☸️", "roda dharma"],
            ["✡️", "estrela davi"],
            ["🔯", "estrela seis pontas"],
            ["🕎", "menorá"],
            ["☯️", "yin yang"],
            ["☦️", "cruz ortodoxa"],
            ["🛐", "local culto"],
            ["⛎", "serpentário signo"],
            ["♈", "áries signo"],
            ["♉", "touro signo"],
            ["♊", "gêmeos signo"],
            ["♋", "câncer signo"],
            ["♌", "leão signo"],
            ["♍", "virgem signo"],
            ["♎", "libra signo"],
            ["♏", "escorpião signo"],
            ["♐", "sagitário signo"],
            ["♑", "capricórnio signo"],
            ["♒", "aquário signo"],
            ["♓", "peixes signo"],
            ["🆔", "identificação"],
            ["⚛️", "átomo"],
            ["🉑", "aceitável"],
            ["☢️", "radioativo"],
            ["☣️", "risco biológico"],
            ["📴", "celular desligado"],
            ["📳", "vibração celular"],
            ["🈶", "ideograma cobrado"],
            ["🈚", "ideograma grátis"],
            ["🈸", "ideograma aplicação"],
            ["🈺", "ideograma aberto"],
            ["🈷️", "ideograma mensal"],
            ["✴️", "estrela oito pontas"],
            ["🆚", "versus"],
            ["💮", "flor branca"],
            ["🉐", "vantagem"],
            ["㊙️", "segredo"],
            ["㊗️", "parabéns"],
            ["🈴", "aprovado"],
            ["🈵", "cheio"],
            ["🈹", "desconto"],
            ["🈲", "proibido"],
            ["🅰️", "grupo sanguíneo a"],
            ["🅱️", "grupo sanguíneo b"],
            ["🆎", "grupo sanguíneo ab"],
            ["🆑", "limpar"],
            ["🅾️", "grupo sanguíneo o"],
            ["🆘", "socorro"],
            ["❌", "xis erro não"],
            ["⭕", "círculo correto"],
            ["🛑", "pare"],
            ["⛔", "entrada proibida"],
            ["📛", "crachá nome"],
            ["🚫", "proibido"],
            ["💯", "cem perfeito"],
            ["💢", "raiva símbolo"],
            ["♨️", "águas termais"],
            ["🚷", "pedestre proibido"],
            ["🚯", "não jogar lixo"],
            ["🚳", "bicicleta proibida"],
            ["🚱", "água não potável"],
            ["🔞", "maiores dezoito"],
            ["📵", "celular proibido"],
            ["🚭", "não fumar"],
            ["❗", "exclamação vermelha"],
            ["❕", "exclamação branca"],
            ["❓", "interrogação vermelha"],
            ["❔", "interrogação branca"],
            ["‼️", "dupla exclamação"],
            ["⁉️", "exclamação interrogação"],
            ["🔅", "brilho baixo"],
            ["🔆", "brilho alto"],
            ["〽️", "alternância"],
            ["⚠️", "aviso atenção"],
            ["🚸", "crianças atravessando"],
            ["🔱", "tridente"],
            ["⚜️", "flor de lis"],
            ["🔰", "iniciante"],
            ["♻️", "reciclagem"],
            ["✅", "confirmado correto"],
            ["🈯", "reservado"],
            ["💹", "gráfico moeda"],
            ["❇️", "brilho"],
            ["✳️", "asterisco oito pontas"],
            ["❎", "xis verde"],
            ["🌐", "globo internet"],
            ["💠", "diamante ponto"],
            ["Ⓜ️", "metrô m"],
            ["🌀", "ciclone"],
            ["💤", "sono"],
            ["🏧", "caixa eletrônico"],
            ["🚾", "banheiro"],
            ["♿", "acessibilidade"],
            ["🅿️", "estacionamento"],
            ["🛗", "elevador"],
            ["🈳", "vaga"],
            ["🈂️", "serviço"],
            ["🛂", "controle passaporte"],
            ["🛃", "alfândega"],
            ["🛄", "bagagem"],
            ["🛅", "guarda volumes"],
            ["🚹", "banheiro masculino"],
            ["🚺", "banheiro feminino"],
            ["🚼", "bebê"],
            ["⚧️", "transgênero"],
            ["🚻", "banheiro"],
            ["🚮", "lixeira"],
            ["🎦", "cinema"],
            ["📶", "sinal rede"],
            ["🈁", "aqui"],
            ["🔣", "símbolos teclado"],
            ["ℹ️", "informação"],
            ["🔤", "letras teclado"],
            ["🔡", "minúsculas"],
            ["🔠", "maiúsculas"],
            ["🆖", "não bom"],
            ["🆗", "ok"],
            ["🆙", "subir"],
            ["🆒", "legal cool"],
            ["🆕", "novo"],
            ["🆓", "grátis"],
            ["0️⃣", "zero número"],
            ["1️⃣", "um número"],
            ["2️⃣", "dois número"],
            ["3️⃣", "três número"],
            ["4️⃣", "quatro número"],
            ["5️⃣", "cinco número"],
            ["6️⃣", "seis número"],
            ["7️⃣", "sete número"],
            ["8️⃣", "oito número"],
            ["9️⃣", "nove número"],
            ["🔟", "dez número"],
            ["🔢", "números"],
            ["#️⃣", "cerquilha hashtag"],
            ["*️⃣", "asterisco"],
            ["⏏️", "ejetar"],
            ["▶️", "reproduzir direita"],
            ["⏸️", "pausar"],
            ["⏯️", "reproduzir pausar"],
            ["⏹️", "parar"],
            ["⏺️", "gravar"],
            ["⏭️", "próximo"],
            ["⏮️", "anterior"],
            ["⏩", "avançar rápido"],
            ["⏪", "voltar rápido"],
            ["⏫", "subir rápido"],
            ["⏬", "descer rápido"],
            ["◀️", "esquerda reproduzir"],
            ["🔼", "triângulo cima"],
            ["🔽", "triângulo baixo"],
            ["➡️", "seta direita"],
            ["⬅️", "seta esquerda"],
            ["⬆️", "seta cima"],
            ["⬇️", "seta baixo"],
            ["↗️", "seta nordeste"],
            ["↘️", "seta sudeste"],
            ["↙️", "seta sudoeste"],
            ["↖️", "seta noroeste"],
            ["↕️", "seta vertical"],
            ["↔️", "seta horizontal"],
            ["↪️", "seta curva direita"],
            ["↩️", "seta curva esquerda"],
            ["⤴️", "seta curva cima"],
            ["⤵️", "seta curva baixo"],
            ["🔀", "aleatório"],
            ["🔁", "repetir"],
            ["🔂", "repetir uma vez"],
            ["🔄", "atualizar"],
            ["🔃", "setas verticais"],
            ["🎵", "nota musical"],
            ["🎶", "notas musicais"],
            ["➕", "mais soma"],
            ["➖", "menos subtração"],
            ["➗", "divisão"],
            ["✖️", "multiplicação"],
            ["🟰", "igual"],
            ["♾️", "infinito"],
            ["💲", "dólar"],
            ["™️", "marca registrada"],
            ["©️", "copyright"],
            ["®️", "registrado"],
            ["〰️", "onda"],
            ["➰", "laço"],
            ["➿", "laço duplo"],
            ["🔚", "fim"],
            ["🔙", "voltar"],
            ["🔛", "ligado"],
            ["🔝", "topo"],
            ["🔜", "em breve"],
            ["✔️", "correto visto"],
            ["☑️", "caixa marcada"],
            ["🔘", "botão rádio"],
            ["🔴", "círculo vermelho"],
            ["🟠", "círculo laranja"],
            ["🟡", "círculo amarelo"],
            ["🟢", "círculo verde"],
            ["🔵", "círculo azul"],
            ["🟣", "círculo roxo"],
            ["🟤", "círculo marrom"],
            ["⚫", "círculo preto"],
            ["⚪", "círculo branco"],
            ["🟥", "quadrado vermelho"],
            ["🟧", "quadrado laranja"],
            ["🟨", "quadrado amarelo"],
            ["🟩", "quadrado verde"],
            ["🟦", "quadrado azul"],
            ["🟪", "quadrado roxo"],
            ["🟫", "quadrado marrom"],
            ["⬛", "quadrado preto"],
            ["⬜", "quadrado branco"],
            ["◼️", "quadrado médio preto"],
            ["◻️", "quadrado médio branco"],
            ["▪️", "quadrado pequeno preto"],
            ["▫️", "quadrado pequeno branco"],
            ["🔶", "losango laranja grande"],
            ["🔷", "losango azul grande"],
            ["🔸", "losango laranja pequeno"],
            ["🔹", "losango azul pequeno"],
            ["🔺", "triângulo vermelho cima"],
            ["🔻", "triângulo vermelho baixo"],
            ["💬", "balão conversa"],
            ["👁️‍🗨️", "olho balão"],
            ["🗨️", "balão esquerda"],
            ["🗯️", "balão raiva"],
            ["💭", "balão pensamento"],
            ["🕐", "uma hora relógio"],
            ["🕑", "duas horas relógio"],
            ["🕒", "três horas relógio"],
            ["🕓", "quatro horas relógio"],
            ["🕔", "cinco horas relógio"],
            ["🕕", "seis horas relógio"],
            ["🕖", "sete horas relógio"],
            ["🕗", "oito horas relógio"],
            ["🕘", "nove horas relógio"],
            ["🕙", "dez horas relógio"],
            ["🕚", "onze horas relógio"],
            ["🕛", "doze horas relógio"]
        ],

        flags: [
            ["🏁", "bandeira quadriculada corrida"],
            ["🚩", "bandeira triangular vermelha"],
            ["🎌", "bandeiras cruzadas"],
            ["🏴", "bandeira preta"],
            ["🏳️", "bandeira branca"],
            ["🏳️‍🌈", "bandeira arco íris orgulho"],
            ["🏳️‍⚧️", "bandeira transgênero"],
            ["🏴‍☠️", "bandeira pirata"],
            ["🇧🇷", "brasil bandeira brasileira"],
            ["🇵🇹", "portugal bandeira portuguesa"],
            ["🇦🇷", "argentina"],
            ["🇺🇾", "uruguai"],
            ["🇵🇾", "paraguai"],
            ["🇨🇱", "chile"],
            ["🇧🇴", "bolívia"],
            ["🇵🇪", "peru"],
            ["🇨🇴", "colômbia"],
            ["🇻🇪", "venezuela"],
            ["🇪🇨", "equador"],
            ["🇬🇾", "guiana"],
            ["🇸🇷", "suriname"],
            ["🇲🇽", "méxico"],
            ["🇺🇸", "estados unidos eua"],
            ["🇨🇦", "canadá"],
            ["🇬🇧", "reino unido inglaterra"],
            ["🇫🇷", "frança"],
            ["🇪🇸", "espanha"],
            ["🇮🇹", "itália"],
            ["🇩🇪", "alemanha"],
            ["🇳🇱", "holanda países baixos"],
            ["🇧🇪", "bélgica"],
            ["🇨🇭", "suíça"],
            ["🇦🇹", "áustria"],
            ["🇮🇪", "irlanda"],
            ["🇬🇷", "grécia"],
            ["🇵🇱", "polônia"],
            ["🇺🇦", "ucrânia"],
            ["🇷🇺", "rússia"],
            ["🇸🇪", "suécia"],
            ["🇳🇴", "noruega"],
            ["🇫🇮", "finlândia"],
            ["🇩🇰", "dinamarca"],
            ["🇮🇸", "islândia"],
            ["🇨🇿", "tchéquia república tcheca"],
            ["🇭🇺", "hungria"],
            ["🇷🇴", "romênia"],
            ["🇭🇷", "croácia"],
            ["🇷🇸", "sérvia"],
            ["🇹🇷", "turquia"],
            ["🇮🇱", "israel"],
            ["🇸🇦", "arábia saudita"],
            ["🇦🇪", "emirados árabes"],
            ["🇮🇳", "índia"],
            ["🇨🇳", "china"],
            ["🇯🇵", "japão"],
            ["🇰🇷", "coreia do sul"],
            ["🇰🇵", "coreia do norte"],
            ["🇹🇭", "tailândia"],
            ["🇻🇳", "vietnã"],
            ["🇵🇭", "filipinas"],
            ["🇮🇩", "indonésia"],
            ["🇲🇾", "malásia"],
            ["🇸🇬", "singapura"],
            ["🇦🇺", "austrália"],
            ["🇳🇿", "nova zelândia"],
            ["🇿🇦", "áfrica do sul"],
            ["🇪🇬", "egito"],
            ["🇲🇦", "marrocos"],
            ["🇳🇬", "nigéria"],
            ["🇦🇴", "angola"],
            ["🇲🇿", "moçambique"],
            ["🇨🇻", "cabo verde"],
            ["🇯🇲", "jamaica"],
            ["🇨🇺", "cuba"],
            ["🇩🇴", "república dominicana"],
            ["🇵🇷", "porto rico"]
        ]
    };

    /*
    Emojis que aceitam modificadores de tom de pele.
    */

    const TONE_CAPABLE_EMOJIS = new Set([
        "👋",
        "🤚",
        "🖐️",
        "✋",
        "🖖",
        "🫱",
        "🫲",
        "🫳",
        "🫴",
        "👌",
        "🤌",
        "🤏",
        "✌️",
        "🤞",
        "🫰",
        "🤟",
        "🤘",
        "🤙",
        "👈",
        "👉",
        "👆",
        "🖕",
        "👇",
        "☝️",
        "🫵",
        "👍",
        "👎",
        "✊",
        "👊",
        "🤛",
        "🤜",
        "👏",
        "🙌",
        "🫶",
        "👐",
        "🤲",
        "🙏",
        "✍️",
        "💅",
        "🤳",
        "💪",
        "🦵",
        "🦶",
        "👂",
        "👃",
        "👶",
        "🧒",
        "👦",
        "👧",
        "🧑",
        "👱",
        "👨",
        "🧔",
        "👩",
        "🧓",
        "👴",
        "👵",
        "🙍",
        "🙎",
        "🙅",
        "🙆",
        "💁",
        "🙋",
        "🧏",
        "🙇",
        "🤦",
        "🤷",
        "👮",
        "🕵️",
        "💂",
        "🥷",
        "👷",
        "🫅",
        "🤴",
        "👸",
        "👳",
        "👲",
        "🧕",
        "🤵",
        "👰",
        "🤰",
        "🫃",
        "🫄",
        "🤱",
        "👼",
        "🎅",
        "🤶",
        "💆",
        "💇",
        "🚶",
        "🧍",
        "🧎",
        "🏃",
        "💃",
        "🕺",
        "🛀"
    ]);

    let initialized = false;
    let selectedCategory = "recent";
    let selectedSkinTone = "";
    let recentEmojis = [
        ...DEFAULT_RECENT_EMOJIS
    ];

    let lastSelectionStart = 0;
    let lastSelectionEnd = 0;

    /*
    ==================================================
    ELEMENTOS
    ==================================================
    */

    function getEmojiPanel() {
        return (
            QRTalk?.elements?.emojiPanel ||
            document.getElementById(
                "emoji-panel"
            )
        );
    }

    function getEmojiButton() {
        return (
            QRTalk?.elements?.emojiBtn ||
            document.getElementById(
                "emoji-btn"
            )
        );
    }

    function getMessageInput() {
        return (
            QRTalk?.elements?.input ||
            document.getElementById(
                "message-input"
            )
        );
    }

    function getEmojiSearchContainer() {
        return document.getElementById(
            "emoji-search"
        );
    }

    function getEmojiListContainer() {
        return document.getElementById(
            "emoji-list"
        );
    }

    /*
    ==================================================
    ESTILOS DO COMPONENTE
    ==================================================
    */

    function injectEmojiStyles() {
        if (
            document.getElementById(
                "qrtalk-emoji-styles"
            )
        ) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "qrtalk-emoji-styles";

        style.textContent = `
            #emoji-panel {
                height: min(360px, 46vh);
                min-height: 270px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                background: #172033;
                border-top: 1px solid var(--border, rgba(255,255,255,.08));
            }

            .emoji-toolbar {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 12px;
                border-bottom: 1px solid var(--border, rgba(255,255,255,.08));
            }

            .emoji-search-input {
                width: 100%;
                min-width: 0;
                height: 38px;
                padding: 0 13px;
                border-radius: 999px;
                background: #1e293b;
                color: #fff;
                border: 1px solid rgba(255,255,255,.08);
                font-size: 14px;
            }

            .emoji-search-input::placeholder {
                color: #94a3b8;
            }

            .emoji-tone-select {
                width: 45px;
                height: 38px;
                flex: 0 0 45px;
                border: 0;
                border-radius: 12px;
                background: #1e293b;
                color: #fff;
                font-size: 20px;
                cursor: pointer;
                outline: none;
            }

            .emoji-categories {
                display: flex;
                overflow-x: auto;
                overscroll-behavior-x: contain;
                scrollbar-width: none;
                padding: 5px 8px;
                border-bottom: 1px solid var(--border, rgba(255,255,255,.08));
            }

            .emoji-categories::-webkit-scrollbar {
                display: none;
            }

            .emoji-category-btn {
                min-width: 42px;
                width: 42px;
                height: 38px;
                flex: 0 0 42px;
                border: 0;
                border-radius: 10px;
                background: transparent;
                color: #cbd5e1;
                font-size: 20px;
                cursor: pointer;
            }

            .emoji-category-btn:hover,
            .emoji-category-btn.active {
                background: rgba(255,255,255,.09);
                color: #fff;
            }

            .emoji-category-btn.active {
                box-shadow: inset 0 -2px 0 var(--primary, #2563eb);
            }

            #emoji-list {
                flex: 1;
                overflow-y: auto;
                overscroll-behavior: contain;
                padding: 8px 10px 14px;
            }

            .emoji-section-title {
                position: sticky;
                top: -8px;
                z-index: 2;
                padding: 9px 4px 7px;
                margin-bottom: 3px;
                background: #172033;
                color: #94a3b8;
                font-size: 12px;
                font-weight: 600;
            }

            .emoji-grid {
                display: grid;
                grid-template-columns: repeat(9, minmax(32px, 1fr));
                gap: 2px;
            }

            .emoji-item {
                min-width: 0;
                height: 39px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 0;
                border-radius: 9px;
                background: transparent;
                font-size: 25px;
                line-height: 1;
                cursor: pointer;
                user-select: none;
            }

            .emoji-item:hover,
            .emoji-item:focus-visible {
                background: rgba(255,255,255,.09);
                transform: scale(1.08);
                outline: none;
            }

            .emoji-item:active {
                transform: scale(.92);
            }

            .emoji-empty-state {
                height: 100%;
                min-height: 130px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 20px;
                color: #94a3b8;
                text-align: center;
                font-size: 14px;
            }

            .emoji-empty-icon {
                font-size: 34px;
            }

            @media (max-width: 430px) {
                #emoji-panel {
                    height: min(335px, 44vh);
                }

                .emoji-grid {
                    grid-template-columns: repeat(8, minmax(31px, 1fr));
                }

                .emoji-item {
                    height: 38px;
                    font-size: 24px;
                }
            }

            @media (max-width: 350px) {
                .emoji-grid {
                    grid-template-columns: repeat(7, minmax(30px, 1fr));
                }
            }

            @media (orientation: landscape) and (max-height: 550px) {
                #emoji-panel {
                    height: min(230px, 55vh);
                    min-height: 180px;
                }

                .emoji-item {
                    height: 34px;
                    font-size: 22px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /*
    ==================================================
    NORMALIZAÇÃO DA PESQUISA
    ==================================================
    */

    function normalizeSearchText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .toLowerCase()
            .trim();
    }

    /*
    ==================================================
    TOM DE PELE
    ==================================================
    */

    function removeSkinTone(emoji) {
        return String(emoji).replace(
            /[\u{1F3FB}-\u{1F3FF}]/gu,
            ""
        );
    }

    function applySkinTone(emoji) {
        const baseEmoji =
            removeSkinTone(emoji);

        if (
            !selectedSkinTone ||
            !TONE_CAPABLE_EMOJIS.has(
                baseEmoji
            )
        ) {
            return baseEmoji;
        }

        const joinerIndex =
            baseEmoji.indexOf("\u200D");

        /*
        Em emojis compostos, o tom deve ser colocado
        antes do primeiro conector invisível.
        */

        if (joinerIndex !== -1) {
            return (
                baseEmoji.slice(
                    0,
                    joinerIndex
                ) +
                selectedSkinTone +
                baseEmoji.slice(
                    joinerIndex
                )
            );
        }

        /*
        O seletor de variação pode aparecer no final
        de alguns emojis. O tom entra antes dele.
        */

        if (baseEmoji.endsWith("\uFE0F")) {
            return (
                baseEmoji.slice(0, -1) +
                selectedSkinTone +
                "\uFE0F"
            );
        }

        return (
            baseEmoji +
            selectedSkinTone
        );
    }

    /*
    ==================================================
    EMOJIS RECENTES
    ==================================================
    */

    function addRecentEmoji(emoji) {
        const value =
            String(emoji || "");

        if (!value) {
            return;
        }

        recentEmojis =
            recentEmojis.filter(
                (item) => item !== value
            );

        recentEmojis.unshift(value);

        if (
            recentEmojis.length >
            MAX_RECENT_EMOJIS
        ) {
            recentEmojis.length =
                MAX_RECENT_EMOJIS;
        }
    }

    /*
    Os recentes ficam somente na memória desta aba.
    Nada é gravado em localStorage ou em banco.
    */

    function getRecentEntries() {
        return recentEmojis.map(
            (emoji) => [
                emoji,
                "recente usado"
            ]
        );
    }

    /*
    ==================================================
    INSERIR EMOJI NO CAMPO
    ==================================================
    */

    function rememberInputSelection() {
        const input =
            getMessageInput();

        if (!input) {
            return;
        }

        if (
            typeof input.selectionStart ===
            "number"
        ) {
            lastSelectionStart =
                input.selectionStart;

            lastSelectionEnd =
                input.selectionEnd;
        }
    }

    function insertEmojiIntoInput(
        emoji
    ) {
        const input =
            getMessageInput();

        if (!input) {
            return false;
        }

        const value =
            input.value || "";

        const start =
            Number.isInteger(
                lastSelectionStart
            )
                ? Math.min(
                    lastSelectionStart,
                    value.length
                )
                : value.length;

        const end =
            Number.isInteger(
                lastSelectionEnd
            )
                ? Math.min(
                    lastSelectionEnd,
                    value.length
                )
                : start;

        input.value =
            value.slice(0, start) +
            emoji +
            value.slice(end);

        const newCursorPosition =
            start + emoji.length;

        input.focus();

        try {
            input.setSelectionRange(
                newCursorPosition,
                newCursorPosition
            );
        } catch (_) {
            // Alguns navegadores antigos podem não aceitar.
        }

        lastSelectionStart =
            newCursorPosition;

        lastSelectionEnd =
            newCursorPosition;

        input.dispatchEvent(
            new Event(
                "input",
                {
                    bubbles: true
                }
            )
        );

        addRecentEmoji(emoji);

        window.dispatchEvent(
            new CustomEvent(
                "qrtalk:emoji-inserted",
                {
                    detail: {
                        emoji
                    }
                }
            )
        );

        return true;
    }

    /*
    ==================================================
    CRIAR BARRA DE PESQUISA
    ==================================================
    */

    function createSearchToolbar() {
        const container =
            getEmojiSearchContainer();

        if (!container) {
            return;
        }

        container.innerHTML = "";

        const toolbar =
            document.createElement("div");

        toolbar.className =
            "emoji-toolbar";

        const searchInput =
            document.createElement("input");

        searchInput.type = "search";

        searchInput.id =
            "emoji-search-input";

        searchInput.className =
            "emoji-search-input";

        searchInput.placeholder =
            "Pesquisar emojis...";

        searchInput.autocomplete =
            "off";

        searchInput.spellcheck =
            false;

        searchInput.setAttribute(
            "aria-label",
            "Pesquisar emojis"
        );

        const toneSelect =
            document.createElement("select");

        toneSelect.id =
            "emoji-tone-select";

        toneSelect.className =
            "emoji-tone-select";

        toneSelect.title =
            "Escolher tom de pele";

        toneSelect.setAttribute(
            "aria-label",
            "Escolher tom de pele"
        );

        SKIN_TONES.forEach(
            (tone) => {
                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    tone.value;

                option.textContent =
                    tone.icon;

                option.title =
                    tone.label;

                toneSelect.appendChild(
                    option
                );
            }
        );

        toneSelect.value =
            selectedSkinTone;

        searchInput.addEventListener(
            "input",
            () => {
                renderEmojiSearch(
                    searchInput.value
                );
            }
        );

        searchInput.addEventListener(
            "keydown",
            (event) => {
                if (
                    event.key ===
                    "Escape"
                ) {
                    closeEmojiPanel();

                    getMessageInput()?.focus();
                }
            }
        );

        toneSelect.addEventListener(
            "change",
            () => {
                selectedSkinTone =
                    toneSelect.value;

                const query =
                    searchInput.value;

                if (query.trim()) {
                    renderEmojiSearch(
                        query
                    );
                } else {
                    renderSelectedCategory();
                }
            }
        );

        toolbar.appendChild(
            searchInput
        );

        toolbar.appendChild(
            toneSelect
        );

        container.appendChild(
            toolbar
        );
    }

    /*
    ==================================================
    CRIAR CATEGORIAS
    ==================================================
    */

    function createCategoryBar() {
        const searchContainer =
            getEmojiSearchContainer();

        if (!searchContainer) {
            return;
        }

        const existing =
            searchContainer.querySelector(
                ".emoji-categories"
            );

        existing?.remove();

        const categoryBar =
            document.createElement("nav");

        categoryBar.className =
            "emoji-categories";

        categoryBar.setAttribute(
            "aria-label",
            "Categorias de emojis"
        );

        CATEGORY_CONFIG.forEach(
            (category) => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type = "button";

                button.className =
                    "emoji-category-btn";

                button.dataset.category =
                    category.id;

                button.textContent =
                    category.icon;

                button.title =
                    category.title;

                button.setAttribute(
                    "aria-label",
                    category.title
                );

                button.setAttribute(
                    "aria-pressed",
                    category.id ===
                        selectedCategory
                        ? "true"
                        : "false"
                );

                if (
                    category.id ===
                    selectedCategory
                ) {
                    button.classList.add(
                        "active"
                    );
                }

                button.addEventListener(
                    "click",
                    () => {
                        selectCategory(
                            category.id
                        );
                    }
                );

                categoryBar.appendChild(
                    button
                );
            }
        );

        searchContainer.appendChild(
            categoryBar
        );
    }

    /*
    ==================================================
    SELECIONAR CATEGORIA
    ==================================================
    */

    function selectCategory(
        categoryId
    ) {
        if (
            categoryId !== "recent" &&
            !EMOJI_CATEGORIES[
                categoryId
            ]
        ) {
            return;
        }

        selectedCategory =
            categoryId;

        const searchInput =
            document.getElementById(
                "emoji-search-input"
            );

        if (searchInput) {
            searchInput.value = "";
        }

        document
            .querySelectorAll(
                ".emoji-category-btn"
            )
            .forEach((button) => {
                const active =
                    button.dataset
                        .category ===
                    categoryId;

                button.classList.toggle(
                    "active",
                    active
                );

                button.setAttribute(
                    "aria-pressed",
                    active
                        ? "true"
                        : "false"
                );
            });

        renderSelectedCategory();
    }

    /*
    ==================================================
    RENDERIZAR EMOJIS
    ==================================================
    */

    function createEmojiButton(
        emoji,
        keywords = ""
    ) {
        const displayedEmoji =
            applySkinTone(emoji);

        const button =
            document.createElement(
                "button"
            );

        button.type = "button";

        button.className =
            "emoji-item";

        button.textContent =
            displayedEmoji;

        button.title =
            keywords || "Emoji";

        button.setAttribute(
            "aria-label",
            keywords || "Emoji"
        );

        /*
        pointerdown evita que o campo de mensagem
        perca a posição do cursor antes da inserção.
        */

        button.addEventListener(
            "pointerdown",
            (event) => {
                event.preventDefault();
            }
        );

        button.addEventListener(
            "click",
            () => {
                insertEmojiIntoInput(
                    displayedEmoji
                );

                if (
                    selectedCategory ===
                    "recent"
                ) {
                    renderSelectedCategory();
                }
            }
        );

        return button;
    }

    function renderEntries(
        title,
        entries
    ) {
        const container =
            getEmojiListContainer();

        if (!container) {
            return;
        }

        container.innerHTML = "";

        if (!entries.length) {
            renderEmptyState(
                "Nenhum emoji encontrado."
            );

            return;
        }

        const titleElement =
            document.createElement("div");

        titleElement.className =
            "emoji-section-title";

        titleElement.textContent =
            title;

        const grid =
            document.createElement("div");

        grid.className =
            "emoji-grid";

        entries.forEach(
            ([emoji, keywords]) => {
                grid.appendChild(
                    createEmojiButton(
                        emoji,
                        keywords
                    )
                );
            }
        );

        container.appendChild(
            titleElement
        );

        container.appendChild(grid);

        container.scrollTop = 0;
    }

    function renderSelectedCategory() {
        const category =
            CATEGORY_CONFIG.find(
                (item) =>
                    item.id ===
                    selectedCategory
            );

        if (!category) {
            return;
        }

        const entries =
            selectedCategory === "recent"
                ? getRecentEntries()
                : EMOJI_CATEGORIES[
                    selectedCategory
                ] || [];

        renderEntries(
            category.title,
            entries
        );
    }

    /*
    ==================================================
    PESQUISAR
    ==================================================
    */

    function getAllEmojiEntries() {
        const entries = [];

        Object.entries(
            EMOJI_CATEGORIES
        ).forEach(
            ([
                categoryId,
                categoryEntries
            ]) => {
                const category =
                    CATEGORY_CONFIG.find(
                        (item) =>
                            item.id ===
                            categoryId
                    );

                categoryEntries.forEach(
                    (entry) => {
                        entries.push({
                            emoji:
                                entry[0],

                            keywords:
                                entry[1],

                            category:
                                category?.title ||
                                categoryId
                        });
                    }
                );
            }
        );

        return entries;
    }

    function renderEmojiSearch(
        query
    ) {
        const normalizedQuery =
            normalizeSearchText(query);

        if (!normalizedQuery) {
            renderSelectedCategory();

            return;
        }

        const words =
            normalizedQuery
                .split(/\s+/)
                .filter(Boolean);

        const seen =
            new Set();

        const results =
            getAllEmojiEntries()
                .filter((entry) => {
                    const searchable =
                        normalizeSearchText(
                            [
                                entry.emoji,
                                entry.keywords,
                                entry.category
                            ].join(" ")
                        );

                    return words.every(
                        (word) =>
                            searchable.includes(
                                word
                            )
                    );
                })
                .filter((entry) => {
                    if (
                        seen.has(
                            entry.emoji
                        )
                    ) {
                        return false;
                    }

                    seen.add(
                        entry.emoji
                    );

                    return true;
                })
                .slice(0, 240)
                .map((entry) => [
                    entry.emoji,
                    entry.keywords
                ]);

        renderEntries(
            `Resultados para “${query.trim()}”`,
            results
        );
    }

    function renderEmptyState(
        message
    ) {
        const container =
            getEmojiListContainer();

        if (!container) {
            return;
        }

        container.innerHTML = "";

        const empty =
            document.createElement("div");

        empty.className =
            "emoji-empty-state";

        const icon =
            document.createElement("div");

        icon.className =
            "emoji-empty-icon";

        icon.textContent = "🔎";

        const text =
            document.createElement("div");

        text.textContent =
            message;

        empty.appendChild(icon);
        empty.appendChild(text);

        container.appendChild(empty);
    }

    /*
    ==================================================
    ABRIR E FECHAR
    ==================================================
    */

    function isEmojiPanelOpen() {
        const panel =
            getEmojiPanel();

        return Boolean(
            panel &&
            !panel.classList.contains(
                "hidden"
            )
        );
    }

    function openEmojiPanel() {
        const panel =
            getEmojiPanel();

        if (!panel) {
            return;
        }

        rememberInputSelection();

        panel.classList.remove(
            "hidden"
        );

        getEmojiButton()?.setAttribute(
            "aria-expanded",
            "true"
        );

        renderSelectedCategory();

        window.dispatchEvent(
            new CustomEvent(
                "qrtalk:emoji-panel-opened"
            )
        );
    }

    function closeEmojiPanel() {
        const panel =
            getEmojiPanel();

        if (!panel) {
            return;
        }

        panel.classList.add(
            "hidden"
        );

        getEmojiButton()?.setAttribute(
            "aria-expanded",
            "false"
        );

        window.dispatchEvent(
            new CustomEvent(
                "qrtalk:emoji-panel-closed"
            )
        );
    }

    function toggleEmojiPanel() {
        if (isEmojiPanelOpen()) {
            closeEmojiPanel();

            getMessageInput()?.focus();
        } else {
            openEmojiPanel();
        }
    }

    /*
    ==================================================
    EVENTOS
    ==================================================
    */

    function handleOutsideClick(
        event
    ) {
        if (!isEmojiPanelOpen()) {
            return;
        }

        const panel =
            getEmojiPanel();

        const button =
            getEmojiButton();

        if (
            panel?.contains(
                event.target
            ) ||
            button?.contains(
                event.target
            )
        ) {
            return;
        }

        closeEmojiPanel();
    }

    function handleGlobalKeydown(
        event
    ) {
        if (
            event.key === "Escape" &&
            isEmojiPanelOpen()
        ) {
            closeEmojiPanel();

            getMessageInput()?.focus();
        }
    }

    function bindInputSelectionEvents() {
        const input =
            getMessageInput();

        if (!input) {
            return;
        }

        [
            "click",
            "keyup",
            "select",
            "input",
            "focus"
        ].forEach(
            (eventName) => {
                input.addEventListener(
                    eventName,
                    rememberInputSelection
                );
            }
        );

        lastSelectionStart =
            input.value.length;

        lastSelectionEnd =
            input.value.length;
    }

    function closeOnOtherAction() {
        [
            "camera-btn",
            "gallery-btn",
            "attach-btn",
            "audio-btn",
            "restart-btn"
        ].forEach((id) => {
            document
                .getElementById(id)
                ?.addEventListener(
                    "click",
                    closeEmojiPanel
                );
        });

        window.addEventListener(
            "qrtalk:message-sent",
            closeEmojiPanel
        );

        window.addEventListener(
            "qrtalk:disconnected",
            closeEmojiPanel
        );

        window.addEventListener(
            "qrtalk:session-ended",
            closeEmojiPanel
        );
    }

    /*
    ==================================================
    INICIALIZAÇÃO
    ==================================================
    */

    function initEmoji() {
        if (initialized) {
            return;
        }

        initialized = true;

        const panel =
            getEmojiPanel();

        const button =
            getEmojiButton();

        if (!panel || !button) {
            console.warn(
                "[QRTalk/Emoji] Elementos do seletor não encontrados."
            );

            return;
        }

        injectEmojiStyles();

        createSearchToolbar();

        createCategoryBar();

        renderSelectedCategory();

        bindInputSelectionEvents();

        closeOnOtherAction();

        button.type = "button";

        button.setAttribute(
            "aria-label",
            "Abrir seletor de emojis"
        );

        button.setAttribute(
            "aria-controls",
            "emoji-panel"
        );

        button.setAttribute(
            "aria-expanded",
            "false"
        );

        button.addEventListener(
            "click",
            toggleEmojiPanel
        );

        document.addEventListener(
            "pointerdown",
            handleOutsideClick
        );

        document.addEventListener(
            "keydown",
            handleGlobalKeydown
        );

        console.log(
            "[QRTalk/Emoji] Seletor de emojis iniciado."
        );
    }

    /*
    ==================================================
    API PÚBLICA
    ==================================================
    */

    window.initEmoji =
        initEmoji;

    window.openEmojiPanel =
        openEmojiPanel;

    window.closeEmojiPanel =
        closeEmojiPanel;

    window.toggleEmojiPanel =
        toggleEmojiPanel;

    window.insertEmoji =
        insertEmojiIntoInput;

    window.selectEmojiCategory =
        selectCategory;

    /*
    Inicialização automática.
    */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initEmoji
        );
    } else {
        initEmoji();
    }
})();