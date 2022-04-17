async function getData() {
    const response = await fetch('http://data.deutsche-biographie.de/beta/solr-open/?q=r_nam:Feuchtwanger*%20AND%20r_nam:L*')
    return response.json();
}

const button = document.getElementById("click");
button.onclick = async function () {
    const data = await getData();
    console.log(data);
}