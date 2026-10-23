// Menú por defecto (tomado del PDF "Menu-shoku-DIGITAL-C").
// Se usa cuando Firebase aún no tiene datos guardados o no responde.
// Una vez que guardes desde admin.html, la versión de Firebase tiene prioridad.

const i = (name, price, desc = '', tag = '') => ({ name, price: String(price), desc, tag, hidden: false });
const g = (title, items, note = '') => ({ title, note, items });

const PROMO_ROLLOS = 'SUSHI AL 2X1 LUNES, MARTES Y MIÉRCOLES* · HAZ TU ROLLO MÁS GRANDE POR SOLO $95';
const NO_VALIDA = '*No válida en días festivos ni acumulable con otras promociones.';

export const DEFAULT_DATA = {
  version: 1,
  settings: {
    brandName: 'Shoku',
    tagline: '',
    logo: 'img/logo.webp',
    accent: '#c9a45c',
    home: {
      video: 'fondo.mp4',
      poster: 'img/rollos.webp',
      overlay: 0.45,
      showLogo: false,
      menuLabel: 'MENÚ',
      buttons: [
        { label: 'MEMBRESÍA', url: 'https://won.cards/4za', visible: true },
        { label: 'RECOMIÉNDANOS', url: 'https://g.page/r/CazHEthkIRcjEAE/review', visible: true }
      ],
      instagram: { url: 'https://www.instagram.com/shoku_tecnologico', icon: 'ig.png', visible: true },
      phone: { number: '+528717302780', icon: 'tel.png', visible: true }
    },
    book: {
      cover: '',
      title: 'MENÚ',
      subtitle: 'Shoku'
    },
    menu: {
      title: 'MENÚ',
      background: 'img/fondot.webp',
      disclaimer: 'En caso de ser alérgico a alguno de nuestros ingredientes, favor de avisar al mesero. Todo platillo se prepara al momento, en un tiempo estimado de 15 a 25 minutos. Los platillos y promociones incluyen 2 salsas.'
    }
  },
  sections: [
    {
      id: 'entradas', name: 'ENTRADAS', hidden: false,
      cover: 'img/entradas.webp',
      images: ['img/entradas1.webp', 'img/entradas3.webp', 'img/entradas.webp'],
      promo: '', note: '',
      groups: [
        g('SASHIMI', [
          i('SASHIMI DE SALMÓN', 299, 'Corte grueso'),
          i('SASHIMI DE SALMÓN', 280, 'Corte delgado'),
          i('MIXTO DE ATÚN, SALMÓN, CAMARÓN Y PULPO', 299, 'Corte delgado'),
          i('SASHIMI DE ATÚN', 279, 'Corte grueso'),
          i('SASHIMI DE ATÚN', 250, 'Corte delgado')
        ]),
        g('TEMAKY / CONO', [
          i('CANGREJO', 145), i('CAMARÓN', 145), i('ATÚN', 135), i('PULPO', 140),
          i('SALMÓN', 150), i('ANGUILA', 145), i('MIXTO (3 MARISCOS)', 160)
        ], 'Arroz, Philadelphia, aguacate, pepino y marisco a elegir'),
        g('ENSALADAS', [
          i('SUNOMONO 130 G', 135, 'Pepino a la vinagreta'),
          i('PULPO 50 G', 165), i('CAMARÓN 50 G', 140), i('CANGREJO 50 G', 160),
          i('SURIMI 50 G', 145), i('SALMÓN 50 G', 170), i('MIXTA 50 G', 175),
          i('EBI ESPECIAL 130 G', 185, 'Pepino, crujiente piel de salmón, camarones a la plancha sazonados con salsas')
        ]),
        g('NIGIRIS', [
          i('SURIMI', 50), i('CAMARÓN', 60), i('PULPO', 65), i('SALMÓN', 70),
          i('CANGREJO', 60), i('ATÚN', 55), i('MASAGO', 65), i('ANGUILA', 78),
          i('COMBO DE PIEZAS', 285, '2 de camarón, 2 de salmón, 2 de cangrejo, 1 de atún y 1 de masago'),
          i('COMBO MISOWI', 310, '2 piezas de nigiri de cada uno (camarón, salmón, masago, atún) acompañado de sopa miso al centro (consomé, cebollín y chiltepín)')
        ]),
        g('YAKITORI / BROCHETAS', [
          i('POLLO', 140), i('CARNE', 145), i('CAMARÓN', 150), i('SALMÓN', 165)
        ], 'Proteína a elección + cebolla y morrón bañados en salsa teriyaki'),
        g('SELECCIÓN SHOKU', [
          i('KUSHIAGE', 130, 'Brochetas de queso empanizadas'),
          i('BAZUCAS', 130, 'Surimi relleno de queso Philadelphia empanizado'),
          i('SOPA MISO', 125, '(Pasta de soja) cebollín y queso tofu'),
          i('EDAMAMES', 135, 'Picantes o salados, 200 g de vainas de soja'),
          i('GYOSAS', 120, 'Rellenas de carne en salsa a la naranja', '5 PIEZAS')
        ])
      ]
    },
    {
      id: 'rollos', name: 'ROLLOS', hidden: false,
      cover: 'img/rollos.webp',
      images: ['img/rollof1.webp', 'img/rollof2.webp', 'img/rollof3.webp'],
      promo: PROMO_ROLLOS, note: NO_VALIDA,
      groups: [
        g('ROLLOS FRÍOS', [
          i('UNAGUI ESPECIAL', 215, 'Cangrejo, camarón, aguacate, pepino, por fuera Philadelphia con anguila'),
          i('AGUIRRE', 205, 'Camarón, cangrejo, pulpo, pepino, por fuera cubierto de Philadelphia'),
          i('ANAGO ESPECIAL', 205, 'Camarón empanizado, Philadelphia, aguacate, por fuera untado de tampico y corte de anguila'),
          i('EBI UNAGUI', 220, 'Camarón, aguacate, por fuera Philadelphia, salmón y anguila'),
          i('MINACU', 204, 'Camarón empanizado, Philadelphia, aguacate, por fuera arroz frito'),
          i('SAPORO', 205, 'Salmón, aguacate, pepino, por fuera Philadelphia y camarón'),
          i('NORUEGA', 199, 'Cangrejo, aguacate, pepino, por fuera Philadelphia y salmón'),
          i('SHAKE NOKAWA', 185, 'Piel de salmón frita, Philadelphia, aguacate, pepino, por fuera ajonjolí y tampico'),
          i('NATURAL ROLL', 149, 'Philadelphia, aguacate, pepino, por fuera ajonjolí'),
          i('NEVADA', 215, 'Salmón, pepino, aguacate, por fuera cubierto de Philadelphia'),
          i('MAIZITO ROLL', 195, 'Surimi, Philadelphia, pepino, por fuera ajonjolí con topping de tampico'),
          i('TORO', 210, 'Atún, Philadelphia, pepino, por fuera masago'),
          i('KAJI ROLL', 210, 'Queso crema, aguacate, camarón capeado. Por fuera salmón flameado', 'AL FUEGO'),
          i('VILLANO', 209, 'Pollo, Philadelphia, aguacate, por fuera gratinado con queso Oaxaca y topping de tampico'),
          i('MAKI YAN', 225, 'Aguacate, salmón y atún, alga por fuera (no contiene arroz)'),
          i('PHILADELPHIA', 213, 'Salmón, Philadelphia, pepino, por fuera masago o ajonjolí'),
          i('ALASKA', 199, 'Camarón, Philadelphia, aguacate, pepino, por fuera masago o ajonjolí'),
          i('SHIRO ROLL', 260, 'Queso crema, aguacate, camarón tempura, kanikama trufado, con topping de tampico mayo', 'HOJA DE ARROZ'),
          i('CALIFORNIA', 190, 'Camarón, aguacate, pepino, por fuera masago o ajonjolí'),
          i('PASTEL', 209, 'Anguila, Philadelphia, por fuera masago con tampico y furikake'),
          i('MIDO', 250, 'Queso crema, pepino, anguila, camarón tempura, con topping de zanahoria frita, bañado en salsa umami', 'HOJA DE ARROZ'),
          i('KANISHI', 199, 'Camarón, aguacate, untado por fuera topping de tampico y masago o ajonjolí'),
          i('TAMPICO', 180, 'Con topping de tampico (ensalada de surimi), por fuera ajonjolí'),
          i('COSMOS ROLL', 213, 'Camarón, pulpo, cangrejo, Philadelphia, aguacate, por fuera ajonjolí'),
          i('TOKIO', 213, 'Camarón empanizado, Philadelphia, aguacate, tampico, por fuera ajonjolí'),
          i('MAKI', '$110 / pieza', 'Envuelto en papel de soja, arroz, aguacate, pepino. Elige tu marisco: salmón, anguila, atún, pulpo o camarón', 'HOJA DE SOJA')
        ]),
        g('ROLLOS ESPECIALES', [
          i('KABUKI', 243, 'Masago, cangrejo, pepino, por fuera salmón, anguila, camarón, Philadelphia y ajonjolí'),
          i('ITALIA', 243, 'Camarón, cangrejo, anguila, masago, aguacate, por fuera salmón'),
          i('FUJI ESPECIAL', 232, 'Camarón, salmón, Philadelphia, aguacate, pepino, por fuera untado tampico y masago, con topping de sirloin'),
          i('MOLOTOV', 215, 'Cangrejo, masago, salmón, por fuera Philadelphia cubierto con pepino'),
          i('ARCOIRIS', 210, 'Cangrejo, anguila, pepino, por fuera Philadelphia, masago, aguacate y ajonjolí'),
          i('ABOKADO', 200, 'Anguila, camarón, Philadelphia, pepino, por fuera aguacate y ajonjolí')
        ]),
        g('ROLLOS EMPANIZADOS Y GRATINADOS', [
          i('MAR Y TIERRA', 219, 'Camarón, sirloin, Philadelphia, aguacate, con topping de tampico'),
          i('VILLA', 219, 'Pollo, Philadelphia, aguacate, gratinado con queso Oaxaca y topping de tampico'),
          i('GEISHA', 218, 'Camarón, Philadelphia, aguacate, tampico, gratinado con queso Oaxaca')
        ]),
        g('ROLLOS EMPANIZADOS', [
          i('NIKI ROLL', 215, 'Masago, cangrejo, pepino; por fuera salmón, anguila, camarón, Philadelphia y ajonjolí'),
          i('TIERRA', 210, 'Sirloin, aguacate y Philadelphia'),
          i('SANDINO', 210, 'Pollo, aguacate y Philadelphia'),
          i('MAÍZ ROLL', 210, 'Surimi, aguacate, Philadelphia, con topping de tampico'),
          i('KANISASHI', 198, 'Tampico (ensalada de surimi) por fuera, Philadelphia, surimi, tampico y furikake'),
          i('CHIP REAL', 219, 'Camarón empanizado, Philadelphia, aguacate; por fuera arroz frito con tampico'),
          i('OKONO', 220, 'Camarón empanizado, Philadelphia, aguacate y topping de tampico'),
          i('OKUSAY', 235, 'Cangrejo, anguila, Philadelphia, aguacate; por fuera salmón')
        ]),
        g('ROLLOS FRUTALES', [
          i('MANGUITO', 205, 'Camarón, Philadelphia, pepino, por fuera mango', 'TEMPORADA'),
          i('BANANA', 205, 'Camarón, Philadelphia, plátano, empanizado con panko')
        ]),
        g('ROLLOS CAPEADOS', [
          i('YUMI', 229, 'Arroz frito, Philadelphia, aguacate, surimi con el alga por fuera y camarón'),
          i('MAGURO', 220, 'Atún, Philadelphia, pepino, con topping de tampico'),
          i('CHIP', 205, 'Camarón empanizado, Philadelphia, aguacate, con topping de tampico'),
          i('HI ROLL', 210, 'Queso crema, pepino, anguila. Por fuera cubierto por salmón', 'AL FUEGO')
        ]),
        g('ROLLOS GRANDES', [
          i('EBI SAKAI', 289, 'Philadelphia, aguacate, cangrejo, tampico, arroz, verdura, con alga por fuera, camarón capeado, acompañado de ½ ensalada ebi especial'),
          i('FUTOMAKI', 280, 'Camarón, anguila, masago, Philadelphia, aguacate, pepino con alga por fuera'),
          i('SHOKU', 275, 'Anguila, camarón, pulpo, Philadelphia, aguacate, pepino, por fuera masago'),
          i('OSAKA', 275, 'Cangrejo, anguila, salmón, Philadelphia, aguacate, pepino, por fuera ajonjolí')
        ]),
        g('EXTRAS', [
          i('TAMPICO', 35, '60 g de ensalada de surimi'),
          i('EXTRA QUESO', 40, 'Philadelphia u Oaxaca'),
          i('SALSA EXTRA', 18, 'Chipotle y anguila 1 oz'),
          i('EMPANIZADO', 35),
          i('HAZLO JUMBO', 90)
        ])
      ]
    },
    {
      id: 'sushi-balls', name: 'SUSHI BALLS', hidden: false,
      cover: 'img/rollof1.webp',
      images: ['img/rollof1.webp', 'img/rollof3.webp'],
      promo: 'JUEVES DE SUSHI BALLS AL 2X1*', note: NO_VALIDA,
      groups: [
        g('SUSHI BALLS', [
          i('CLÁSICA', 184, 'Philadelphia, aguacate, tampico, camarón'),
          i('GOURMET', 205, 'Philadelphia, aguacate, tampico, camarón, gratinada con queso Oaxaca y con topping de cebolla frita y sirloin'),
          i('MIXTA', 214, 'Philadelphia, aguacate, pollo, sirloin, cubierta de arroz frito, con topping de tampico, camarones y cebollín'),
          i('LAGUNA', 205, 'Philadelphia, aguacate, salmón frito, gratinada con queso Oaxaca, con topping de camarón y aderezo chipotle'),
          i('REGIA', 199, 'Philadelphia, aguacate, sirloin, con topping de tampico, champiñones y aderezo de chipotle'),
          i('PASTORCITA', 198, 'Por dentro aguacate y pastor, por fuera gratinada, con topping de pastor y cebolla frita'),
          i('CHICKEN', 197, 'Philadelphia, aguacate, pollo, gratinada con queso Oaxaca y topping de tocino'),
          i('PEKIN', 208, 'Por dentro sirloin con cebolla frita, queso Oaxaca, aguacate; por fuera con topping de pollo a la naranja')
        ])
      ]
    },
    {
      id: 'yakimeshi-teppan', name: 'YAKIMESHI Y TEPPAN YAKI', hidden: false,
      cover: 'img/teppan.webp',
      images: ['img/teppan.webp', 'img/comb2.webp'],
      promo: '', note: '',
      groups: [
        g('YAKIMESHI 300 G', [
          i('YAKIMESHI', 118, 'Solo verduras'),
          i('POLLO', 135), i('SIRLOIN', 145), i('CAMARÓN', 150), i('PULPO', 175),
          i('MIXTO', 180, 'Pollo, camarón y sirloin')
        ], 'Arroz frito con verduras, zanahoria, calabaza y cebolla'),
        g('YAKIMESHI DE LA CASA', [
          i('YAKIMESHI SHOKU', 179, 'Arroz frito, sirloin, camarón, champiñones, tampico, aguacate y cebollín'),
          i('YAKIMESHI ESPECIAL', 249, 'Arroz frito, sirloin, pulpo, camarón, tampico, queso crema, aguacate, cebollín y furikake'),
          i('YAKIMESHI TRUFADO', 180, 'Arroz frito con verduras y rib eye')
        ]),
        g('TEPPAN YAKI 430 G', [
          i('TEPPAN YAKI', 145, 'Solo verduras'),
          i('POLLO', 210), i('SIRLOIN', 220), i('CAMARÓN', 240), i('SALMÓN', 280),
          i('MIXTO', 290, 'Pollo, camarón y sirloin'),
          i('TEPPAN YAKI DE PULPO', 280),
          i('MIXTO DE MARISCOS', 310, 'Arroz frito con verduras, zanahoria, calabaza y cebolla'),
          i('TEPPAN YAKI DE RIB EYE', 280)
        ], 'Calabaza, morrón, cebolla, brócoli, coliflor y germen de soya')
      ]
    },
    {
      id: 'platillos', name: 'PLATILLOS', hidden: false,
      cover: 'img/plati3.webp',
      images: ['img/plati3.webp', 'img/comb1.webp', 'img/comb2.webp'],
      promo: '', note: '',
      groups: [
        g('PLATILLOS', [
          i('SALMÓN NATURAL 300 G', 285, 'Salmón a la plancha acompañado de gohan (arroz al vapor)'),
          i('POLLO TERIYAKI 520 G', 225, 'En salsa agridulce, con porción de yakimeshi, brócoli y coliflor'),
          i('CARNE TERIYAKI 520 G', 225, 'En salsa agridulce, con porción de yakimeshi, brócoli y coliflor'),
          i('MIXTO TERIYAKI 520 G', 250, 'En salsa agridulce, con porción de yakimeshi, brócoli y coliflor. Pollo, sirloin y camarón')
        ]),
        g('PLATILLOS EMPANIZADOS', [
          i('ZAKANA', 210, 'Pescado empanizado 350 g'),
          i('TEMPURA MIXTO', 290, 'Camarón, morrón, calabaza, zanahoria, cebolla, brócoli y coliflor (platillo capeado, no incluye ensalada)'),
          i('EBI FRAY', 230, '5 camarones empanizados 140 g. Agrega queso Philadelphia por $20'),
          i('COMBINADO', 265, 'Corte de salmón empanizado con queso, 2 piezas de camarón empanizado con queso'),
          i('TORI FRAY', 210, 'Fajitas de pollo empanizadas 120 g'),
          i('SALMÓN', 275, 'Con queso, empanizado 140 g')
        ], 'Todos los platillos incluyen una porción de yakimeshi y ensalada de pepino')
      ]
    },
    {
      id: 'ramen', name: 'RAMEN, PASTA Y ARROZ', hidden: false,
      cover: 'img/plati2.webp',
      images: ['img/plati2.webp', 'img/especiales1.webp'],
      promo: '', note: '',
      groups: [
        g('PASTA, ARROZ Y RAMEN', [
          i('RAMEN CLÁSICO 450 G', 185, 'Pollo, costilla, camarón, pasta. Con huevo, naruto y cebollín'),
          i('RAMEN SPICY 450 G', 225, 'Pollo, costilla, camarón, pasta. Con huevo, naruto y cebollín. Picante'),
          i('GOHAN', 65, '300 g de arroz al vapor'),
          i('GOHAN SAKE', 190, '435 g de arroz al vapor con salmón, surimi, masago y tampico'),
          i('KIMUSHI NAVE', 185, 'Camarón, pescado, pollo, harusame de soya, germen de soya, queso de soya, brócoli, coliflor, zanahoria y calabaza'),
          i('YAKIUDON', 240, 'Espagueti (pasta japonesa), pollo, camarón, cebolla, zanahoria, calabaza y germen de soya')
        ]),
        g('RAMEN CON PASTA ARTESANAL', [
          i('MIDORI RAMEN', 199, 'Caldo de la casa, fideos especiales, huevo, nori sazonada y un toque especial de Shoku'),
          i('TONKOTSU', 205, 'Caldo cremoso de cerdo, fideos japoneses, lomo de cerdo, huevo de cocción suave y toppings de la casa'),
          i('MISO RAMEN', 185, 'Caldo con miso, más intenso y con mucho umami. Elige entre pollo, camarón o costilla de cerdo'),
          i('KURO RAMEN', 199, 'Caldo de la casa, salsa de ostión, chicharrón de salmón y un toque especial de la casa')
        ])
      ]
    },
    {
      id: 'especiales', name: 'ESPECIALES Y BOWLS', hidden: false,
      cover: 'img/especiales.webp',
      images: ['img/especiales.webp', 'img/plati1.webp', 'img/especiales1.webp'],
      promo: '', note: '',
      groups: [
        g('PLATILLOS ESPECIALES', [
          i('BONELESS', 175, 'Con salsa buffalo, mango habanero o BBQ. Agrega papas a la francesa por $25'),
          i('ALITAS', 185, 'Con salsa buffalo, mango habanero o BBQ. Agrega papas a la francesa por $25'),
          i('POLLO LIGHT 200 G', 175, 'Acompañado de arroz al vapor, brócoli y coliflor'),
          i('POLLO A LA NARANJA 300 G', 125),
          i('PAPAS FRANCESAS O GAJO 170 G', 75),
          i('PAPAS CRISSCUT 170 G', 80),
          i('AROS DE CEBOLLA 170 G', 90)
        ]),
        g('BOWLS', [
          i('BOWL CLÁSICO', 170, '2 proteínas, 2 complementos, base de arroz al vapor 150 g'),
          i('BOWL FIT', 215, '3 proteínas, 3 complementos, base de arroz al vapor 150 g')
        ], 'Todo lo bueno cabe en un bowl. Proteínas: camarón, salmón, pollo, atún, carne, kanikama, huevo, surimi. Complementos: aguacate, tampico, furikake, pepino, edamames, queso crema, mango (solo por temporada).')
      ]
    },
    {
      id: 'infantil', name: 'MENÚ INFANTIL', hidden: false,
      cover: 'img/kids.webp',
      images: ['img/kids1.webp', 'img/kids2.webp'],
      promo: '', note: '',
      groups: [
        g('INFANTIL', [
          i('FILETE DE PESCADO EMPANIZADO', 125),
          i('NUGGETS DE POLLO', 125, '5 piezas'),
          i('1 FAJITA EMPANIZADA', 125)
        ], 'Acompañados de papas a la francesa 100 g')
      ]
    },
    {
      id: 'promociones', name: 'PROMOCIONES', hidden: false,
      cover: 'img/combos.webp',
      images: ['img/comb1.webp', 'img/comb2.webp'],
      promo: '', note: '',
      groups: [
        g('COMBOS', [
          i('COMBO INDIVIDUAL', 230, '½ yakimeshi de pollo o sirloin o ½ sunomono de surimi, refresco o limonada 355 ml y un rollo a elegir. Empanizado: Maíz Roll o Sandino. Fríos: Alaska o California'),
          i('COMBO YAKI', 250, '½ yakimeshi de pollo o sirloin o ½ sunomono de surimi, 1 bazuca y un rollo a elegir. Empanizado: Mar y Tierra, Villa, Chip Real, Okono. Fríos: Anago Especial o Saporo'),
          i('COMBO ORIENTAL', 250, 'Pollo a la naranja (porción), yakimeshi 150 g (arroz y verdura) y un rollo a elegir. Empanizado: Okono, Tierra, Sandino, Mar y Tierra o Maíz Roll. Fríos: Tokio, Alaska, Philadelphia o Kanishi'),
          i('COMBO SHOKU', 280, '1 arroz pollo, 1 filete o ½ ensalada de surimi y un rollo a elegir. Empanizado: Sandino o Maíz Roll. Fríos: Tokio, Alaska o Philadelphia'),
          i('COMBO TEC', 240, '200 g de boneless o alitas y un rollo a elegir. Empanizado: Okono, Tierra, Sandino o Kanisashi. Fríos: Tokio, Alaska, California o Minacu'),
          i('PAQUETE FAMILIAR', 599, '1 orden de bazucas, 1 arroz mixto, 1 ensalada de surimi, 1 jarra de limonada o 3 refrescos 355 ml y dos rollos a elegir. Empanizado: Okono, Tierra, Sandino o Kanisashi. Fríos: Tokio, Alaska o Minacu')
        ]),
        g('BOXES PARA COMPARTIR', [
          i('SPECIAL BOX', 450, 'Ideal para compartir entre dos personas: boneless 150 g, papas a la francesa 100 g y 2 rollos a elegir (entre seleccionados)'),
          i('THE SHOKU BOX', 680, 'Ideal para compartir entre tres y cinco personas: boneless 150 g, alitas 200 g, edamames 100 g, papas a la francesa 100 g, papas gajo 200 g, aros de cebolla 200 g y 3 rollos a elegir (entre seleccionados)')
        ], 'Rollos seleccionados — Fríos: Philadelphia, Kanishi, Alaska, Tokio. Empanizados: Tierra, Maíz Roll, Sandino, Okono.')
      ]
    },
    {
      id: 'postres', name: 'POSTRES', hidden: false,
      cover: 'img/postres.webp',
      images: ['img/postres1.webp', 'img/postres2.webp', 'img/entradas2.webp'],
      promo: '', note: '',
      groups: [
        g('POSTRES', [
          i('TEMPURA HELADO', 135, 'Pan relleno de helado de vainilla, capeado, cubierto con mermelada de fresa, chocolate o cajeta'),
          i('BANANA YAKI', 125, 'Plátano capeado con 1 bola de helado de vainilla con mermelada de fresa, chocolate o cajeta'),
          i('HELADO AL TINTO', 155, 'Bola de helado gourmet, servido en copa con un toque de vino tinto'),
          i('MOCHI TEMPURA', 90, 'Helado tempurizado, con chocolate caliente y polvo de matcha'),
          i('MOCHI CLÁSICO', 80)
        ])
      ]
    },
    {
      id: 'bebidas', name: 'BEBIDAS', hidden: false,
      cover: 'img/bebidas.webp',
      images: ['img/bebi1.webp', 'img/bebi2.webp', 'img/bebi3.webp'],
      promo: '', note: '',
      groups: [
        g('SIN ALCOHOL', [
          i('AGUA EMBOTELLADA 500 ML', 45), i('REFRESCO 355 ML', 55), i('FUZE TEA 600 ML', 55),
          i('ARIZONA 355 ML', 50), i('AGUA MINERAL 355 ML', 55), i('NARANJADA 700 ML', 65),
          i('JARRA DE LIMONADA 1.3 L', 160, 'Clásica'),
          i('JARRA DE LIMONADA 1.3 L', 180, 'Frutos rojos, fresa, pepino, piña o mango'),
          i('LIMONADA DE SABOR 700 ML', 70, 'Clásica, frutos rojos, curazao, fresa, mango, pepino o coco')
        ]),
        g('TÉS', [
          i('OSHA 700 ML', 79, 'Té verde frío o caliente'),
          i('JAZMÍN 700 ML', 79, 'Frío o caliente'),
          i('DETOX 700 ML', 79, 'Té verde con limón, frío o caliente'),
          i('JARRA DE TÉ 1.3 L', 160, 'Jazmín, detox, osha, cebada y oolong')
        ]),
        g('MOCKTAILS', [
          i('MIDORI', 140, 'Pepino, manzana verde, limón y soda / 400 ml'),
          i('SAKURA', 140, 'Fresa, lychee, limón y soda / 400 ml'),
          i('YUZU BLOSSOM', 140, 'Yuzu, flor de jamaica, limón y soda / 400 ml'),
          i('SHIRO', 140, 'Lychee, coco, limón y agua mineral / 400 ml'),
          i('AKAI', 140, 'Frutos rojos, limón y soda / 400 ml'),
          i('MATCHA FIZZ', 140, 'Matcha, limón, miel y soda / 400 ml'),
          i('MANGO MISO', 140, 'Mango, limón, miel y un toque de miso / 400 ml'),
          i('TROPICAL NAMI', 140, 'Maracuyá, piña, limón y soda / 400 ml'),
          i('KOI', 140, 'Sandía, fresa, limón y hierbabuena / 400 ml')
        ]),
        g('REFRESCANTES', [
          i('PIÑADA 470 ML', 85), i('FRESADA 470 ML', 95), i('RUSA 470 ML', 80),
          i('SANGRÍA 470 ML', 85), i('CUCUMBER 500 ML', 75)
        ])
      ]
    },
    {
      id: 'bar', name: 'BAR Y MIXOLOGÍA', hidden: false,
      cover: 'img/bebi3.webp',
      images: ['img/bebi3.webp', 'img/bebi2.webp', 'img/bebidas.webp'],
      promo: '', note: '',
      groups: [
        g('MIXOLOGÍA', [
          i('APEROL SPRITZ', 140, '400 ml / Aperol'),
          i('PALOMA', 115, '400 ml / tequila'),
          i('SEX ON THE BEACH', 120, '400 ml / vodka'),
          i('CONGA', 120, '400 ml / vodka'),
          i('LIMONADA ELÉCTRICA', 140, '400 ml / vodka'),
          i('FRESA COLADA', 125, '400 ml / ron'),
          i('PIÑA COLADA', 130, '400 ml / ron'),
          i('CARAJILLO', 135, '400 ml / Licor 43, café'),
          i('BAILEYS EN LAS ROCAS', 135, '2 oz'),
          i('MARGARITA', 130, 'Clásica · fresa · mango · frutos rojos · pepino. Tequila, Cointreau, limón, sal. 400 ml'),
          i('VAMPIRO', 120, '400 ml / tequila, fresca, sangrita y limón'),
          i('BLOODY MARY', 145, '400 ml / tequila, jugo de tomate, salsa, limón'),
          i('NOBLE PUNCH', 150, '400 ml / tequila, jugo de limón, jugo de piña, refresco'),
          i('MALIBÚ BLACK', 150, '400 ml / ron blanco cítrico'),
          i('MALIBÚ BARBIE', 140, '400 ml / ron blanco y coco'),
          i('APEROL ICE', 150, '400 ml / frapeado'),
          i('PALOMA APEROL', 160, '400 ml / con tequila'),
          i('MOJITOS', 150, 'Clásico, pepino, fresa o frutos rojos / 400 ml'),
          i('GIN TONIC', 135, 'Frutos rojos, fresa o mango / 460 ml'),
          i('CLERICOT', 150, 'Clásico o rosado / 460 ml'),
          i('DAIQUIRI', 140, 'Clásico o fresa / 460 ml'),
          i('MEZCALITOS', 160, 'Jamaica, frutos rojos, fresa, serrano, tuna, piña, sandía o tamarindo / 400 ml'),
          i('BLOODY MARY 400 ML', 145, '400 ml / tequila, azúcar, jugo de limón, menta')
        ]),
        g('CERVEZA', [
          i('VICTORIA 355 ML', 55), i('CORONA 355 ML', 55), i('MODELO NEGRA 355 ML', 65),
          i('MODELO ESPECIAL 355 ML', 65), i('STELLA ARTOIS 355 ML', 70), i('ULTRA MICHELOB 355 ML', 65)
        ]),
        g('PREPARADOS', [
          i('CLAMATO', 45), i('CLAMATO 1 L', 65), i('MICHELADA', 39), i('CHELADO', 35)
        ]),
        g('WHISKY 2 OZ', [
          i('ETIQUETA ROJA', 100), i('ETIQUETA NEGRA', 150), i('BUCHANAN’S', 150)
        ]),
        g('RON 2 OZ', [i('BACARDÍ', 85), i('MATUSALEM', 80)]),
        g('BRANDY 2 OZ', [i('TORRES 10', 85), i('TORRES 15', 90)]),
        g('TEQUILA 2 OZ', [
          i('JOSÉ CUERVO TRADICIONAL', 90), i('DON JULIO 70', 165),
          i('MAESTRO DOBEL', 150), i('30-30 CRISTALINO', 85)
        ])
      ]
    }
  ]
};
