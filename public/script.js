async function search() {
  const query = document.getElementById("search").value;

  const res = await fetch(`http://localhost:3000/search?q=${query}`);
  const data = await res.json();

  const resultsDiv = document.getElementById("results");

  resultsDiv.innerHTML = data.map(item => `
    <div class="card">
      <div class="platform">${item.platform}</div>
      <div>${item.text}</div>
    </div>
  `).join("");
}