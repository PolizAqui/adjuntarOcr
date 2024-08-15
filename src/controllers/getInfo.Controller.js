const AWS = require('aws-sdk');
const multer = require('multer');
const fs = require('fs');
const util = require('util');
const unlinkFile = util.promisify(fs.unlink);
const upload = multer({ dest: 'uploads/' });

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const textract = new AWS.Textract();

const controller = {};

const identifyDocumentType = (text) => {
  const normalizedText = text.toLowerCase().trim();
  if (normalizedText.includes('republica bolivariana de venezuela') || normalizedText.includes('republica bolivariana de venezuel') || normalizedText.includes('republica bolivarlana de venezuela') || normalizedText.includes('republica bolivarianade venezuela')) {
    return 'cedula';
  } else if (normalizedText.includes('licencia para conducir')) {
    return 'licencia';
  } else if (normalizedText.includes('certificado de circulación') || normalizedText.includes('ap1')) {
    return 'certificado';
  }
  return 'desconocido';
};

const buscarModelo = (texto, modelos) => {
  const textoMayus = texto.toUpperCase();
  return modelos.find(modelo => textoMayus.includes(modelo.toUpperCase())) || "Modelo no encontrado";
};

const extractData = (text, patterns, years) => {
  console.log('Extracting data...');
  const data = {};
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  console.log('Lines:', lines);

  // Extraer información utilizando patrones definidos
  lines.forEach(line => {
    for (const [key, regex] of Object.entries(patterns)) {
      const match = line.match(regex);
      if (match) {
        console.log(`Match found for ${key}:`, match[1].trim());
        data[key] = match[1].trim();
      }
    }
  });


  const cedulaPattern =/\b[VE][ -]?\d{8}\b/i; // Ajusta este patrón según el formato de cédula esperado
  const cedulaMatch = text.match(cedulaPattern);
  console.log('Cedula pattern match:', cedulaMatch);
  if (cedulaMatch) {
    data.cedula = cedulaMatch[0];
  }
  // Buscar número de carrocería y serial de motor con longitud variable
  const generalPattern = /([A-Z0-9]{15,})/gi; // Captura cualquier texto alfanumérico con longitud de 15 o más caracteres
  const matches = text.match(generalPattern);
  console.log('General pattern matches:', matches);

  if (matches) {
    // Asignar el primer match como número de carrocería si no está definido
    if (!data.numero_carroceria) {
      data.numero_carroceria = matches[0].trim();
    }
    // Asignar el segundo match como serial de motor si está disponible y no está definido
    if (matches[1] && !data.serial_de_motor) {
      data.serial_de_motor = matches[1].trim();
    } else if (!data.serial_de_motor) {
      data.serial_de_motor = matches[0].trim(); // Si solo hay un match, asignar el mismo valor
    }
  }

  // Buscar placa en el texto
  const platePattern = /\b[A-Z0-9]{7}\b/i;
  const plateMatch = text.match(platePattern);
  console.log('Plate pattern match:', plateMatch);
  if (plateMatch) {
    data.placa = plateMatch[0];
  }

  // Buscar marca en el texto
  const marcaPattern = new RegExp(`\\b(${marca.join('|')})\\b`, 'i');
  const marcaMatch = text.match(marcaPattern);
  console.log('Marca pattern match:', marcaMatch);
  if (marcaMatch) {
    data.marca = marcaMatch[1];
  }

  // Buscar año en el texto y agregarlo a los datos si coincide
  const yearMatch = years.find(year => text.includes(year));
  console.log('Year match:', yearMatch);
  if (yearMatch) {
    data.año = yearMatch;
  }

  const ocupantesPattern = /(\d+)\s*PTOS/i;
 const ocupantesMatch = text.match(ocupantesPattern);
 console.log('Ocupantes pattern match:', ocupantesMatch);
 if (ocupantesMatch) {
   data.ocupantes = ocupantesMatch[1];
 }

  // Extraer fecha de nacimiento específicamente para la licencia
  const fechaNacimientoPattern = /F\.?\s*Nacimiento\s*:?([\s\S]*?)(?=\n|$)/i;
  const fechaNacimientoMatch = text.match(fechaNacimientoPattern);
  console.log('Fecha Nacimiento pattern match:', fechaNacimientoMatch);
  if (fechaNacimientoMatch) {
    data.fecha_nacimiento = fechaNacimientoMatch[1].trim();
  }

  // Extraer nombre y apellido
  const nombrePattern = /NOMBRES\s+([A-Z\s]+)(?=\n|$)/;
  const nombreMatch = text.match(nombrePattern);
  if (nombreMatch) {
    data.nombre = nombreMatch[1].trim();
  }
  
  // Extraer apellido
  const apellidoPattern = /APELLIDOS\s+([A-Z\s]+)(?=\n|$)/;
  const apellidoMatch = text.match(apellidoPattern);
  if (apellidoMatch) {
    data.apellido = apellidoMatch[1].trim();
  }

  const modeloEncontrado = buscarModelo(text, modelos);
  data.modelo = modeloEncontrado;

  console.log('Extracted data:', data);
  return data;

};

 // Buscar y extraer valor de ocupantes con "PTOS"
 

const colors = [
  'Rojo', 'Azul', 'Verde', 'Negro', 'Plata','Blanco', 'Gris', 'Amarillo', 'Naranja', 
  'Violeta', 'Marrón', 'Beige', 'Plateado', 'Dorado', 'Azul Marino', 'Verde Oscuro',
  'Rojo Oscuro', 'Azul Claro', 'Verde Claro', 'Gris Oscuro', 'Gris Claro',
  'Negro Mate', 'Blanco Perlado', 'Borgoña'
];

const ano = [
  "1970", "1971", "1972", "1973", "1974", "1975", "1976", "1977", "1978", "1979",
  "1980", "1981", "1982", "1983", "1984", "1985", "1986", "1987", "1988", "1989",
  "1990", "1991", "1992", "1993", "1994", "1995", "1996", "1997", "1998", "1999",
  "2000", "2001", "2002", "2003", "2004", "2005", "2006", "2007", "2008", "2009",
  "2010", "2011", "2012", "2013", "2014", "2015", "2016", "2017", "2018", "2019",
  "2020", "2021", "2022", "2023", "2024"
];

const marca = [
  "ABARTH", "ALFA ROMEO", "ARO", "ASIA", "ASIA MOTORS", "ASTON MARTIN", "AUDI", "AUSTIN", 
  "AUVERLAND", "BENTLEY", "BERTONE", "BMW", "CADILLAC", "CHEVROLET", "CHRYSLER", "CITROEN", 
  "CORVETTE", "DACIA", "DAEWOO", "DAF", "DAIHATSU", "DAIMLER", "DODGE", "FERRARI", "FIAT", 
  "FORD", "GALLOPER", "GMC", "HONDA", "HUMMER", "HYUNDAI", "INFINITI", "INNOCENTI", "ISUZU", 
  "IVECO", "IVECO-PEGASO", "JAGUAR", "JEEP", "KIA", "LADA", "LAMBORGHINI", "LANCIA", 
  "LAND-ROVER", "LDV", "LEXUS", "LOTUS", "MAHINDRA", "MASERATI", "MAYBACH", "MAZDA", 
  "MERCEDES BENZ", "MG", "MINI", "MITSUBISHI", "MORGAN", "NISSAN", "OPEL", "PEUGEOT", 
  "PONTIAC", "PORSCHE", "RENAULT", "ROLLS-ROYCE", "ROVER", "SAAB", "SANTANA", "SEAT", 
  "SKODA", "SMART", "SSANGYONG", "SUBARU", "SUZUKI", "TALBOT", "TATA", "TOYOTA", 
  "UMM", "VAZ", "VOLKSWAGEN", "VOLVO", "WARTBURG", "HINO", "KEEWAY", "BAJAJ", "JAC", 
  "BERA", "HAOJUE", "CHERY", "MACK", "YAMAHA", "REMOLQUES", "MARCA DE PRUEBA", 
  "HAIMA", "KYMC", "LINHAI", "PIAGGIO", "VENIRAUTO", "BATEAS GERPLAP", 
  "FRENOS DEL AIRE DEL C", "REMOLQUEZ WAL", "DONGFENG", "SKYGO", "KAWASAKI", "BENELLI", 
  "TRIUMPH", "VESPA", "HARLEY-DAVIDSON", "MD", "ENCAVA", "TIUNA", "SPORTSTER", "SG", 
  "DUCATI", "CHANGAN", "INTERNATIONAL", "DFSK", "REMOLQUES", "MAXUS", "SAIPA", 
  "FREIGHTLINER", "TORO", "CHUTOS MACK", "LINCOLN"
];

const modelos = [
  "GRANDE PUNTO", "PUNTO EVO", "PUNTO", "GTV", "SPIDER", "GT", "CROSSWAGON", "BRERA", "GIULIETTA", "SPRINT", "MITO", "DACIA", "ROCSTA", "ROCSTA", "DB7", "V8", "DB9", "VANQUISH", "V8 VANTAGE", "VANTAGE", "DBS", "VOLANTE", "VIRAGE", "VANTAGE V8", "VANTAGE V12", "RAPIDE", "CYGNET", "A4", "A6", "S6", "COUPE", "S2", "RS2", "A8", "CABRIOLET", "S8", "A3", "S4", "TT", "S3", "ALLROAD QUATTRO", "RS4", "A2", "RS6", "Q7", "R8", "A5", "S5", "V8", "TTS", "Q5", "A4 ALLROAD QUATTRO", "TT RS", "RS5", "A1", "A7", "RS3", "Q3", "A6 ALLROAD QUATTRO", "S7", "SQ5", "MINI", "MONTEGO", "MAESTRO", "METRO", "MINI MOKE", "DIESEL", "BROOKLANDS", "TURBO", "CONTINENTAL", "AZURE", "ARNAGE", "CONTINENTAL GT", "CONTINENTAL FLYING SPUR", "TURBO R", "MULSANNE", "EIGHT", "CONTINENTAL GTC", "CONTINENTAL SUPERSPORTS", "FREECLIMBER DIESEL", "SERIE 3", "SERIE 5", "COMPACT", "SERIE 7", "SERIE 8", "Z3", "Z4", "Z8", "X5", "SERIE 6", "X3", "SERIE 1", "Z1", "X6", "X1", "SEVILLE", "STS", "EL DORADO", "CTS", "XLR", "SRX", "ESCALADE", "BLS", "CORVETTE", "BLAZER", "ASTRO", "NUBIRA", "EVANDA", "TRANS SPORT", "CAMARO", "MATIZ", "ALERO", "TAHOE", "TACUMA", "TRAILBLAZER", "KALOS", "AVEO", "LACETTI", "EPICA", "CAPTIVA", "HHR", "CRUZE", "SPARK", "ORLANDO", "VOLT", "MALIBU", "VISION", "GRAND VOYAGER", "VIPER", "NEON", "VOYAGER", "STRATUS", "SEBRING", "SEBRING 200C", "NEW YORKER", "PT CRUISER", "CROSSFIRE", "XANTIA", "XM", "AX", "ZX", "EVASION", "SAXO", "XSARA", "XSARA PICASSO", "C5", "C3", "C3 PLURIEL", "C1", "GRAND C4 PICASSO", "C4 PICASSO", "CCROSSER", "JUMPER", "JUMPY", "BERLINGO", "BERLINGO FIRST", "C3 PICASSO", "DS3", "DS4", "DS5", "C4 AIRCROSS", "CELYSEE", "CONTAC", "LOGAN", "SANDERO", "DUSTER", "LODGY", "NEXIA", "ARANOS", "LANOS", "NUBIRA", "NUBIRA COMPACT", "LEGANZA", "EVANDA", "MATIZ", "TACUMA", "KALOS", "LACETTI", "APPLAUSE", "CHARADE", "ROCKY", "FEROZA", "TERIOS", "SIRION", "SERIE XJ", "XJ", "DOUBLE SIX", "SIX", "SERIES III", "VIPER", "CALIBER", "NITRO", "AVENGER", "JOURNEY", "F355", "F430", "F512 M", "550 MARANELLO", "575M MARANELLO", "456", "456M", "612", "ENZO", "SUPERAMERICA", "TESTAROSSA", "512", "MONDIAL", "CALIFORNIA", "458", "FF", "CROMA", "CINQUECENTO", "SEICENTO", "GRANDE PUNTO", "PANDA", "TIPO", "COUPE", "ULYSSE", "TEMPRA", "MAREA", "BARCHETTA", "BRAVO", "STILO", "BRAVA", "PALIO WEEKEND", "MULTIPLA", "IDEA", "SEDICI", "LINEA", "FIORINO", "DUCATO", "DOBLO CARGO", "DOBLO", "STRADA", "REGATA", "TALENTO", "ARGENTA", "RITMO", "QUBO", "PUNTO EVO", "FREEMONT", "PANDA CLASSIC", "MAVERICK", "ESCORT", "FOCUS", "MONDEO", "SCORPIO", "FIESTA", "PROBE", "EXPLORER", "GALAXY", "PUMA", "COUGAR", "FOCUS CMAX", "FUSION", "STREETKA", "CMAX", "SMAX", "TRANSIT", "COURIER", "RANGER", "SIERRA", "ORION", "PICK UP", "CAPRI", "GRANADA", "KUGA", "GRAND CMAX", "BMAX", "TOURNEO CUSTOM", "EXCEED", "SANTAMO", "SUPER EXCEED", "ACCORD", "CIVIC", "CRX", "PRELUDE", "NSX", "LEGEND", "CRV", "HRV", "LOGO", "S2000", "STREAM", "JAZZ", "FRV", "CONCERTO", "INSIGHT", "CRZ", "LANTRA", "SONATA", "ELANTRA", "ACCENT", "SCOUPE", "COUPE", "ATOS", "H1", "ATOS PRIME", "XG", "TRAJET", "SANTA FE", "TERRACAN", "MATRIX", "GETZ", "TUCSON", "I30", "PONY", "GRANDEUR", "I10", "I800", "SONATA FL", "IX55", "I20", "IX35", "IX20", "GENESIS", "I40", "VELOSTER", "G", "EX", "FX", "M", "ELBA", "MINITRE", "TROOPER", "D MAX", "RODEO", "DAILY", "MASSIF", "DUTY", "SERIE XK", "STYPE", "XF", "XTYPE", "WRANGLER", "CHEROKEE", "GRAND CHEROKEE", "COMMANDER", "COMPASS", "WRANGLER UNLIMITED", "PATRIOT", "SPORTAGE", "SEPHIA", "SEPHIA II", "PRIDE", "CLARUS", "SHUMA", "CARNIVAL", "JOICE", "MAGENTIS", "CARENS", "RIO", "CERATO", "SORENTO", "OPIRUS", "PICANTO", "CEED", "CEED SPORTY WAGON", "PROCEED", "K2500 FRONTIER", "K2500", "SOUL", "VENGA", "OPTIMA", "CEED SPORTSWAGON", "SAMARA", "NIVA", "SAGONA", "STAWRA 2110", "KALINA", "PRIORA", "GALLARDO", "MURCIELAGO", "AVENTADOR", "DELTA", "DEDRA", "LYBRA", "YPSILON", "THESIS", "PHEDRA", "MUSA", "THEMA", "KAPPA", "TREVI", "PRISMA", "A112", "YPSILON ELEFANTINO", "VOYAGER", "RANGE ROVER", "DEFENDER", "DISCOVERY", "FREELANDER", "RANGE ROVER SPORT", "DISCOVERY 4", "RANGE ROVER EVOQUE", "MAXUS", "LS400", "LS430", "GS300", "IS300"
];


const colorPattern = new RegExp(`\\b(${colors.join('|')})\\b`, 'i');

const documentPatterns = {
  cedula: {
    nombre: /NOMBRES\s+([A-Z\s]+)\n/,
    apellido: /APELLIDOS\s+([A-Z\s]+)\n/,
    numero_de_cedula: /\b([VE]-?\s?\d{1,3}(?:\.\d{3}){1,2})\b/i,
  },
  licencia: {
    nombre: /Nombres:\s*(.+)/i,
    apellido: /Apellidos:\s*(.+)/i,
    fecha_nacimiento: /F\.?\s*Nacimiento\s*:?([\s\S]*?)(?=\n|$)/i,
    fecha_vencimiento: /F\. Vencimiento:\s*(\d{2}\/\d{2}\/\d{4})/i,
    cedula: /\b([VE]-?\s?\d{1,3}(?:\.\d{3}){1,2})\b/i,
    sexo: /Sexo:\s*(.+)/i
  },
  certificado: {
    cedula: /\b[VE]-?\s?\d{1,3}(?:\.\d{3}){1,2}\b|\b[VE]\d{1,3}(?:\.\d{3}){1,2}\b/i,
    color: colorPattern,
    numero_carroceria: /número de carrocería:\s*(.+)/i,
    serial_de_motor: /serial de motor:\s*(.+)/i,
    placa: /placa:\s*(\w+)/i,
    año: /\b(\d{4})\b/i,
    ocupantes: /ocupantes:\s*(\d+)/i,
    marca: new RegExp(`\\b(${marca.join('|')})\\b`, 'i'),
    modelo: /modelo:\s*(.+)/i
  }
};

const createJsonResponse = (documentType, data) => {
  console.log('Creating JSON response...');
  console.log('Document Type:', documentType);
  console.log('Extracted Data:', data);
  let responseJson;
  switch (documentType) {
    case 'cedula':
      responseJson = {
        nombre: data.nombre || '',
        apellido: data.apellido || '',
        numero_de_cedula: data.numero_de_cedula || '',
      };
      break;
    case 'licencia':
      responseJson = {
        nombre: data.nombre || '',
        apellido: data.apellido || '',
        fecha_nacimiento: data.fecha_nacimiento || '',
        fecha_vencimiento: data.fecha_vencimiento || '',
        cedula: data.cedula || '',
        sexo: data.sexo || ''
      };
      break;
    case 'certificado':
      responseJson = {
        cedula: data.cedula || '',
        color: data.color || '',
        numero_carroceria: data.numero_carroceria || '',
        serial_de_motor: data.serial_de_motor || '',
        placa: data.placa || '',
        año: data.año || '',
        ocupantes: data.ocupantes || '',
        marca: data.marca || '',
        modelo: data.modelo || ''
      };
      break;
    default:
      responseJson = { error: 'Tipo de documento desconocido' };
  }
  console.log('Response JSON:', responseJson);
  return responseJson;
};

controller.uploadArchive = async (req, res) => {
  console.log('Handling file upload...');
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('Upload Error:', err);
      return res.status(500).send({ error: 'Error al cargar el archivo' });
    }

    const file = req.file;
    console.log('Uploaded File:', file);
    const fileContent = fs.readFileSync(file.path);
    console.log('File Content Length:', fileContent.length);

    const params = {
      Document: {
        Bytes: fileContent
      }
    };

    try {
      const data = await textract.detectDocumentText(params).promise();
      console.log('Textract Response:', data);

      const extractedText = data.Blocks.filter(block => block.BlockType === 'LINE').map(line => line.Text).join('\n');
      console.log('Extracted Text:', extractedText);

      const documentType = identifyDocumentType(extractedText);
      console.log('Document Type Identified:', documentType);

      const patterns = documentPatterns[documentType] || {};
      const responseData = extractData(extractedText, patterns, ano);
      const responseJson = createJsonResponse(documentType, responseData);

      await unlinkFile(file.path); // Eliminar el archivo después del procesamiento
      res.status(200).json(responseJson);
    } catch (error) {
      console.error('Processing Error:', error);
      res.status(500).send({ error: 'Error al procesar el documento' });
    }
  });
};

module.exports = controller;
