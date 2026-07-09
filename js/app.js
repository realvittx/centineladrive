
    var map = L.map('map').setView(
        [-33.5167, -70.7667],
        13
    );

    L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            maxZoom: 19
        }
    ).addTo(map);

    let origen = null;
    let destino = null;

    let marcadorOrigen = null;
    let marcadorDestino = null;

    let rutaActual = null;
    let rutaAlternativa = null;

    let zonasRiesgo = [];



    const iconoOrigen = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const iconoDestino = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
async function cargarZonasRiesgo(){

    const respuesta =
        await fetch("datos/centinela_dataset.json");

    zonasRiesgo =
        await respuesta.json();

    zonasRiesgo.forEach(zona=>{

        const color =
            obtenerColorCategoria(zona.categoria);

        L.circle(
            [zona.lat, zona.lng],
            {
                radius: zona.radio,
                color: color,
                fillColor: color,
                fillOpacity: 0.25,
                weight: 2,
                interactive: false
            }
        )
        .addTo(map)
        .bindTooltip(`
            <b>${zona.nombre}</b><br>
            ${zona.categoria}<br>
            Nivel ${zona.nivel}/5
        `);

    });

}

function rutaTieneRiesgo(geometria){

    let puntajeRiesgo = 0;
    let riesgoSeguridad = 0;
    let riesgoCongestion = 0;
    let riesgoAccidente = 0;
    let riesgoEvento = 0;
    let riesgoObras = 0;

    for(const punto of geometria.coordinates){

        const lng = punto[0];
        const lat = punto[1];

        for(const zona of zonasRiesgo){

            const distancia = Math.sqrt(
                Math.pow(lat - zona.lat,2) +
                Math.pow(lng - zona.lng,2)
            );

            // Conversión aproximada de metros a grados
            const radioGrados = zona.radio / 111000;

            if(distancia < radioGrados){

    const factor =
        1 - (distancia / radioGrados);

    const aporte =
        zona.nivel *
        zona.peso *
        factor;

    puntajeRiesgo += aporte;

    switch(zona.categoria){

        case "Seguridad":
            riesgoSeguridad += aporte;
            break;

        case "Congestion":
            riesgoCongestion += aporte;
            break;

        case "Accidente":
            riesgoAccidente += aporte;
            break;

        case "Evento":
            riesgoEvento += aporte;
            break;

        case "Obras":
            riesgoObras += aporte;
            break;

        }

        }

        }

    }

    return{

    total: puntajeRiesgo,

    seguridad: riesgoSeguridad,

    congestion: riesgoCongestion,

    accidente: riesgoAccidente,

    evento: riesgoEvento,

    obras: riesgoObras

    };

}

function calcularEscudos(score){

    if(score <= 0.20){
        return 5;
    }

    if(score <= 0.40){
        return 4;
    }

    if(score <= 0.60){
        return 3;
    }

    if(score <= 0.80){
        return 2;
    }

    return 1;

}

function obtenerCategoriaDominante(analisis){

    const categorias = [

        {
            nombre:"Seguridad",
            valor:analisis.seguridad
        },

        {
            nombre:"Congestión",
            valor:analisis.congestion
        },

        {
            nombre:"Accidentes",
            valor:analisis.accidente
        },

        {
            nombre:"Eventos",
            valor:analisis.evento
        },

        {
            nombre:"Obras",
            valor:analisis.obras
        }

    ];

    categorias.sort(
        (a,b)=>b.valor-a.valor
    );

    return categorias[0];

}

function analizarRuta(ruta){

    const analisis =
        rutaTieneRiesgo(ruta.geometry);

    const score =
        calcularScore(
            ruta,
            analisis.total
        );

    const escudos =
        calcularEscudos(score);

    const categoria =
        obtenerCategoriaDominante(
            analisis
        );

    return{

        ruta:ruta,

        analisis:analisis,

        score:score,

        escudos:escudos,

        categoria:categoria

    };

}

function calcularScore(ruta,riesgo){

    return{

        tiempo:ruta.duration/60,

        distancia:ruta.distance/1000,

        riesgo:riesgo

    };

}

function mostrarEscudos(cantidad){

    let texto = "";

    for(let i=0;i<cantidad;i++){

    texto += "🛡";

}

return texto;

}

    async function calcularRuta() {

    if(origen === null || destino === null){
        return;
    }

    // --------------------
    // RUTA PRINCIPAL
    // --------------------

    const urlPrincipal =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${origen.lng},${origen.lat};${destino.lng},${destino.lat}` +
        `?overview=full&geometries=geojson`;

    const respuestaPrincipal =
        await fetch(urlPrincipal);

    const datosPrincipal =
        await respuestaPrincipal.json();

//------------------------------------
// ETAPA 1
// OBTENER RUTAS
//------------------------------------


    const rutaPrincipal =
        datosPrincipal.routes[0];

    if(
    !datosPrincipal.routes ||
    datosPrincipal.routes.length===0
    ){

    alert("No fue posible calcular la ruta.");

    return;

    }
    
    
    
    // --------------------
    // PUNTO INTERMEDIO
    // --------------------

    //------------------------------------
// MOTOR CENTINELA
// PUNTO INTERMEDIO INTELIGENTE
//------------------------------------

let latMedia =
    (origen.lat + destino.lat) / 2;

let lngMedia =
    (origen.lng + destino.lng) / 2;

// Buscar la zona de mayor riesgo cercana
let zonaCritica = null;
let mayorNivel = 0;

for(const zona of zonasRiesgo){

    const distancia = Math.sqrt(

        Math.pow(latMedia - zona.lat,2) +

        Math.pow(lngMedia - zona.lng,2)

    );

    if(distancia < 0.05 && zona.nivel > mayorNivel){

        mayorNivel = zona.nivel;

        zonaCritica = zona;

    }

}

// Si existe una zona crítica,
// desplazamos el punto intermedio
if(zonaCritica){

    if(latMedia < zonaCritica.lat){

        latMedia -= 0.015;

    }else{

        latMedia += 0.015;

    }

    if(lngMedia < zonaCritica.lng){

        lngMedia -= 0.015;

    }else{

        lngMedia += 0.015;

    }

}
else{

    // comportamiento anterior
    latMedia += 0.01;

}

    // --------------------
    // RUTA ALTERNATIVA
    // --------------------

    const urlAlternativa =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${origen.lng},${origen.lat};` +
        `${lngMedia},${latMedia};` +
        `${destino.lng},${destino.lat}` +
        `?overview=full&geometries=geojson`;

    const respuestaAlternativa =
        await fetch(urlAlternativa);

    const datosAlternativa =
        await respuestaAlternativa.json();

    const rutaAlt =
    datosAlternativa.routes[0];

//------------------------------------
// ETAPA 2
// ANALIZAR RUTAS
//------------------------------------

    const analisisPrincipal =
        rutaTieneRiesgo(
        rutaPrincipal.geometry
    );

    const analisisAlternativo =
        rutaTieneRiesgo(
        rutaAlt.geometry
    );

    const resultadoPrincipal =
        analizarRuta(rutaPrincipal);

    const resultadoAlternativo =
        analizarRuta(rutaAlt);

    const categoriaPrincipal =
        obtenerCategoriaDominante(
        analisisPrincipal
    );

    const categoriaAlternativa =
        obtenerCategoriaDominante(
        analisisAlternativo
    );

    const riesgoPrincipal =
    analisisPrincipal.total;

    const riesgoAlternativo =
    analisisAlternativo.total;

    const riesgoDetectado =
    riesgoPrincipal > 0;

    let recomendacion = "🔵 Ruta Principal";

    let nivel = "Bajo";

    let clase = "valorBueno";

    if(riesgoDetectado){

    recomendacion = "🛡 Ruta Más Segura";

    nivel = "Alto";

    clase = "valorMalo";

}

function mostrarTarjetaPrincipal(

    distanciaPrincipal,
    tiempoPrincipal,
    riesgoEscala,
    escudosPrincipal

){

document.getElementById("tarjetaPrincipal").innerHTML = `

    <h2 class="tituloRuta">

    🛡 Ruta Centinela

    <span class="badgeRuta">

    RECOMENDADA

    </span>

    </h2>

    <div class="escudosCentinela">

    ${mostrarEscudos(escudosPrincipal)}

    </div>

    <div class="datosRuta">

    <div>

    📏

    <br>

    <b>${distanciaPrincipal.toFixed(2)} km</b>

    </div>

    <div>

    ⏱

    <br>

    <b>${tiempoPrincipal.toFixed(1)} min</b>

    </div>

    <div>

    📍

    <br>

    <b>${riesgoEscala}/5</b>

    </div>

    </div>

    `;

}

      
//------------------------------------
// ETAPA 3
// CALCULAR INDICADORES
//------------------------------------

    const tiempoPrincipal =
    rutaPrincipal.duration/60;

    const tiempoAlternativo =
    rutaAlt.duration/60;

    const distanciaPrincipal =
    rutaPrincipal.distance/1000;

    const distanciaAlternativa =
    rutaAlt.distance/1000;

// Valores máximos

    const maxTiempo =
    Math.max(tiempoPrincipal, tiempoAlternativo);

const maxDistancia =
Math.max(distanciaPrincipal, distanciaAlternativa);

const maxRiesgo =
Math.max(riesgoPrincipal, riesgoAlternativo,1);

// Normalización

const t1 =
tiempoPrincipal/maxTiempo;

const t2 =
tiempoAlternativo/maxTiempo;

const d1 =
distanciaPrincipal/maxDistancia;

const d2 =
distanciaAlternativa/maxDistancia;

const r1 =
riesgoPrincipal/maxRiesgo;

const r2 =
riesgoAlternativo/maxRiesgo;

//------------------------------------
// PESOS
//------------------------------------

const pesoTiempo = 0.40;

const pesoDistancia = 0.30;

const pesoRiesgo = 0.30;

//------------------------------------
// SCORE FINAL
//------------------------------------

const scorePrincipal =

pesoTiempo*t1 +

pesoDistancia*d1 +

pesoRiesgo*r1;

const scoreAlternativo =

pesoTiempo*t2 +

pesoDistancia*d2 +

pesoRiesgo*r2;

const escudosPrincipal =
calcularEscudos(scorePrincipal);

const escudosAlternativo =
calcularEscudos(scoreAlternativo);

const riesgoEscala = Math.min(
    5,
    Math.max(
        1,
        Math.ceil(r1 * 5)
    )
);

const riesgoEscalaAlternativa = Math.min(
    5,
    Math.max(
        1,
        Math.ceil(r2 * 5)
    )
);

const diferenciaTiempo =
(tiempoAlternativo - tiempoPrincipal).toFixed(1);

const diferenciaDistancia =
(distanciaAlternativa - distanciaPrincipal).toFixed(2);

const diferenciaRiesgo =
riesgoPrincipal - riesgoAlternativo;

let rutaRecomendadaSistema;

if(scorePrincipal < scoreAlternativo){

    rutaRecomendadaSistema =
    "🛡 Ruta Centinela";

}
else{

    rutaRecomendadaSistema =
    "🔀 Ruta Comparativa";

}

//------------------------------------
// ETAPA 4
// ACTUALIZAR MAPA
//------------------------------------

    if(rutaActual){
        map.removeLayer(rutaActual);
    }

    if(rutaAlternativa){
        map.removeLayer(rutaAlternativa);
    }

    // --------------------
    // DIBUJAR AZUL
    // --------------------

    rutaActual =
        L.geoJSON(rutaPrincipal.geometry, {
            style: {
                color: "#0066ff",
                weight: 6
            }
        }).addTo(map);

    // --------------------
    // DIBUJAR ALTERNATIVA
    // --------------------

    rutaAlternativa =
    L.geoJSON(rutaAlt.geometry,{
    style:{
        color:"#00897B",
        weight:5,
        opacity:0.9
    }
    }).addTo(map);

    let grupoRutas = L.featureGroup([
    rutaActual,
    rutaAlternativa
    ]);

    map.fitBounds(
    grupoRutas.getBounds(),
    {
        padding: [30, 30]
    }
    );

        
//------------------------------------
// ETAPA 5
// ACTUALIZAR INTERFAZ
//------------------------------------

mostrarTarjetaPrincipal(

    distanciaPrincipal,

    tiempoPrincipal,

    riesgoEscala,

    escudosPrincipal

);
document.getElementById("tarjetaAlternativa").innerHTML = `

<h2 class="tituloRuta">

🧭 Ruta Alternativa

<span class="badgeComparativa">

ALTERNATIVA

</span>

</h2>

<div class="escudosCentinela">

${mostrarEscudos(escudosAlternativo)}

</div>

<div class="datosRuta">

<div>

📏

<br>

<b>${distanciaAlternativa.toFixed(2)} km</b>

</div>

<div>

⏱

<br>

<b>${tiempoAlternativo.toFixed(1)} min</b>

</div>

<div>

📍

<br>

<b>${riesgoEscalaAlternativa}/5</b>

</div>

</div>

`;


const diferenciaTiempoAbs =
Math.abs(tiempoAlternativo - tiempoPrincipal);

const diferenciaDistanciaAbs =
Math.abs(distanciaAlternativa - distanciaPrincipal);

document.getElementById("tarjetaComparacion").innerHTML = `

<h2 class="tituloRuta">

📊 Análisis Comparativo

</h2>

<div class="comparacionFila">

<span>⏱ Tiempo</span>

<b>${tiempoPrincipal.toFixed(1)} min</b>

</div>

<div class="comparacionBarra">

<div
class="comparacionValor"
style="width:${(100-(t1*100)).toFixed(0)}%">
</div>

</div>

<div class="comparacionFila">

<span>📏 Distancia</span>

<b>${distanciaPrincipal.toFixed(2)} km</b>

</div>

<div class="comparacionBarra">

<div
class="comparacionValor"
style="width:${(100-(d1*100)).toFixed(0)}%">
</div>

</div>

<div class="comparacionFila">

<span>⚠ Riesgo</span>

<b>${riesgoEscala}/5</b>

</div>

<div class="comparacionBarra">

<div
class="comparacionValorRiesgo"
style="width:${riesgoEscala*20}%">
</div>

</div>

<div class="decisionSistema">

🛡 <b>${rutaRecomendadaSistema}</b>

<br><br>

Reduce aproximadamente

<b>${diferenciaTiempoAbs.toFixed(1)} min</b>

y

<b>${diferenciaDistanciaAbs.toFixed(2)} km</b>

respecto a la alternativa.

</div>

`;

document.getElementById("rutaRecomendada").innerHTML =
    rutaRecomendadaSistema;

    document.getElementById("nivelRiesgo").innerHTML =
    nivel;

    document.getElementById("nivelRiesgo").className =
    clase;

    
}

async function buscarDirecciones(){

    let textoOrigen =
        document.getElementById("txtOrigen").value.trim();

    let textoDestino =
        document.getElementById("txtDestino").value.trim();

    if(origen === null && textoOrigen === ""){

        alert("Debes ingresar un origen o utilizar Mi ubicación.");

        return;

    }

    if(textoDestino === ""){

        alert("Debes ingresar un destino.");

        return;

    }

    // Buscar origen SOLO si no viene desde GPS
    if(origen === null){

        const urlOrigen =
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(textoOrigen)}`;

        const respuestaOrigen =
            await fetch(urlOrigen);

        const datosOrigen =
            await respuestaOrigen.json();

        if(datosOrigen.length === 0){

            alert("No se encontró el origen.");

            return;

        }

        origen = {

            lat: parseFloat(datosOrigen[0].lat),

            lng: parseFloat(datosOrigen[0].lon)

        };

    }

    // Buscar destino
    const urlDestino =
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(textoDestino)}`;

    const respuestaDestino =
        await fetch(urlDestino);

    const datosDestino =
        await respuestaDestino.json();

    if(datosDestino.length === 0){

        alert("No se encontró el destino.");

        return;

    }

    
    destino = {

        lat: parseFloat(datosDestino[0].lat),

        lng: parseFloat(datosDestino[0].lon)

    };

    if(marcadorOrigen){

    map.removeLayer(marcadorOrigen);

}

if(marcadorDestino){

    map.removeLayer(marcadorDestino);

}


marcadorOrigen =
L.marker(origen,{
    icon:iconoOrigen
})
.addTo(map)
.bindPopup("Origen");

marcadorDestino =
L.marker(destino,{
    icon:iconoDestino
})
.addTo(map)
.bindPopup("Destino");

const grupo =
L.featureGroup([
    marcadorOrigen,
    marcadorDestino
]);

map.fitBounds(
    grupo.getBounds(),
    {
        padding:[40,40]
    }
);

}

/* 

// Autocompletar para proxima version

let temporizadorBusqueda = null;

async function autocompletar(input, contenedor){

    if(!contenedor){

        console.error("No existe el contenedor de sugerencias.");

        return;

    }

    const texto = input.value.trim();

    if(texto.length < 3){

        contenedor.style.display = "none";

        return;

    }

    const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(texto)}`;

    const respuesta =
        await fetch(url);

    const datos =
        await respuesta.json();

    contenedor.innerHTML = "";

    datos.forEach(lugar=>{

        let div = document.createElement("div");

        div.className = "itemSugerencia";

        div.innerText = lugar.display_name;

        div.onclick = function(){

            input.value = lugar.display_name;

            contenedor.style.display = "none";

        };

        contenedor.appendChild(div);

    });

    contenedor.style.display = "block";

}

*/
 
function reiniciarMapa(){

   
    if(marcadorOrigen){
        map.removeLayer(marcadorOrigen);
    }

   
    if(marcadorDestino){
        map.removeLayer(marcadorDestino);
    }

  
    if(rutaActual){
        map.removeLayer(rutaActual);
    }

    
    if(rutaAlternativa){
        map.removeLayer(rutaAlternativa);
    }


    marcadorOrigen = null;
    marcadorDestino = null;

    rutaActual = null;
    rutaAlternativa = null;

    document.getElementById("txtOrigen").value = "";
    document.getElementById("txtDestino").value = "";

    }

   async function obtenerUbicacion(){

    if(!navigator.geolocation){

        alert("El navegador no soporta GPS.");

        return;

    }

    navigator.geolocation.getCurrentPosition(

        function(posicion){

            const lat =
            posicion.coords.latitude;

            const lng =
            posicion.coords.longitude;

            origen = {

            lat: lat,

            lng: lng

        };

            if(marcadorOrigen){

                map.removeLayer(
                    marcadorOrigen
                );

            }

            marcadorOrigen =
            L.marker(
                origen,
                {
                    icon:iconoOrigen
                }
            ).addTo(map);

            marcadorOrigen.bindPopup(
                "Mi ubicación"
            );

            map.setView(
                origen,
                15
            );

        }

    );

} 

    map.on('click', function(e){

        if(origen === null){

            origen = e.latlng;

            marcadorOrigen = L.marker(origen, {
                icon: iconoOrigen
            })
                .addTo(map)
                .bindPopup("Origen")
                .openPopup();

            console.log("Origen:", origen);

        }

        else if(destino === null){

            destino = e.latlng;

            marcadorDestino = L.marker(destino, {
                icon: iconoDestino
            })
                .addTo(map)
                .bindPopup("Destino")
                .openPopup();

            console.log("Destino:", destino);

            
        }

            else{

                reiniciarMapa();

                origen = e.latlng;

                marcadorOrigen = L.marker(origen,{
                icon:iconoOrigen
            })
                .addTo(map)
                .bindPopup("Origen")
                .openPopup();

            }

    });
    document.getElementById("btnBuscar")
.addEventListener("click", buscarDirecciones);

    document.getElementById("btnUbicacion")
.addEventListener("click", obtenerUbicacion);

    document.getElementById("btnRuta")
.addEventListener("click", calcularRuta);

    document.getElementById("btnReset")
.addEventListener("click", reiniciarMapa);

cargarZonasRiesgo();

function obtenerColorCategoria(categoria){

    switch(categoria){

    case "Seguridad":

    return "#C62828";

    case "Congestion":

    return "#F9A825";

    case "Accidente":

    return "#EF6C00";

    case "Evento":

    return "#8E24AA";

    case "Obras":

    return "#1565C0";

    default:

    return "#607D8B";

    }

    }

    /*

// Autocompletado en Proceso para version futura

    const txtOrigen=
document.getElementById("txtOrigen");

const txtDestino=
document.getElementById("txtDestino");

txtOrigen.addEventListener("input", () => {

    clearTimeout(temporizadorBusqueda);

    temporizadorBusqueda = setTimeout(() => {

        autocompletar(
            txtOrigen,
            document.getElementById("sugerenciasOrigen")
        );

    }, 300);

});

txtDestino.addEventListener("input", () => {

    clearTimeout(temporizadorBusqueda);

    temporizadorBusqueda = setTimeout(() => {

        autocompletar(
            txtDestino,
            document.getElementById("sugerenciasDestino")
        );

    }, 300);

});

*/