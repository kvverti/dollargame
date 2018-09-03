var graph = d3.select("#graph");
var nodes = graph.selectAll(".graph-node");
var edges = graph.selectAll(".graph-edge");
var linkForce = d3.forceLink().distance(75);
var centerForce = d3.forceCenter();
var sim = d3.forceSimulation()
    .force("charge", d3.forceManyBody().strength(-100))
    .force("link", linkForce)
    .force("center", centerForce)
    .on("tick", updateGraph);
var drag = d3.drag()
    .on("start", function() {
        var s = d3.event.subject;
        s.fx = s.x;
        s.fy = s.y;
        sim.alphaTarget(1.0).restart();
    })
    .on("drag", function() {
        var s = d3.event.subject;
        s.fx = d3.event.x;
        s.fy = d3.event.y;
    })
    .on("end", function(d) {
        var s = d3.event.subject;
        s.fx = s.fy = null;
        sim.alphaTarget(0.0);
    });
//currently selected node
var selected = null;

d3.select("svg")
    .call(d3.zoom()
        .on("zoom", function() {
            graph.attr("transform", d3.event.transform);
        }))
    .on("dblclick.zoom", null);

//generates edges to form a connected graph and sets the initial counts
//for each node. The total count is at least as large as the genus.
function generateNewEdges(nodes, surplus, range) {
    //generate the edge data. We want a connected graph, so
    //we keep an array of the nodes not in the connected segment,
    //removing them when we connect an edge between them.
    var ncon = nodes.slice(1); //non-connected nodes
    var conn = [nodes[0]]; //connected nodes
    var edges = [];
    while(ncon.length > 0) {
        var node1 = conn[Math.floor(Math.random() * conn.length)];
        var node2 = ncon.splice(Math.floor(Math.random() * ncon.length), 1)[0];
        node1.adj.push(node2);
        node2.adj.push(node1);
        conn.push(node2);
        edges.push({ source: node1, target: node2 });
    }
    //add a few cycles in
    for(var i = 0; i < nodes.length / 3; i++) {
        var node1;
        var node2;
        do { node1 = nodes[Math.floor(Math.random() * nodes.length)]; }
        while(node1.adj.length === nodes.length - 1);
        do { node2 = nodes[Math.floor(Math.random() * nodes.length)]; }
        while(node1.id === node2.id || node1.adj.find(el => el.id === node2.id));
        node1.adj.push(node2);
        node2.adj.push(node1);
        edges.push({ source: node1, target: node2 });
    }
    var genus = edges.length - nodes.length + 1;
    //assign an initial value
    for(var idx in nodes) {
        var count = Math.floor(Math.random() * range * 2) - range;
        nodes[idx].count = count;
        genus -= count;
    }
    //assign leftovers to guarantee solvability
    while(genus-- > 0) {
        nodes[Math.floor(Math.random() * nodes.length)].count++;
    }
    //make the total count exactly equal to the genus for extra challenge
    if(!surplus) {
        console.log(surplus);
        while(++genus < 0) {
            nodes[Math.floor(Math.random() * nodes.length)].count--;
        }
    }
    return edges;
}

function generateGraph(num, surplus, range) {
    //generate the node data
    sim.stop();
    resetStats();
    var newData = Array.from(Array(num)).map((e, i) => ({ id: i, count: 0, adj: [] }));
    var newEdges = generateNewEdges(newData, surplus, range);
    //generate edges
    edges = graph.selectAll(".graph-edge")
        .data(newEdges);
    edges.exit().remove();
    edges = edges.enter()
      .append("line")
        .attr("class", "graph-edge")
      .merge(edges);
    //generate nodes
    nodes = graph.selectAll(".graph-node")
        .data(newData);
    nodes.exit().remove();
    nodes = nodes.enter()
      .append("g")
        .on("click", handleClick)
        .on("contextmenu", handleContext)
        .on("mouseover", handleHover)
        .on("mouseout", handleHoverEnd)
        .attr("class", "graph-node")
        .call(sel => sel.append("circle").attr("r", 20))
        .call(sel => sel.append("text"))
      .merge(nodes)
        .call(drag)
        .call(updateText)
        .order();
    linkForce.links(newEdges);
    var rect = graph.node().parentNode.getBoundingClientRect();
    centerForce.x((rect.right - rect.left) / 2);
    centerForce.y((rect.bottom - rect.top) / 2);
    sim.nodes(nodes.data()).alpha(1.0).restart();
}

function updateGraph() {
    nodes.attr("transform", d => "translate(" + d.x + "," + d.y + ")");
    edges.attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
}

function handleClick(d) {
    //give to adjacent
    d.count -= d.adj.length;
    d.adj.forEach(el => el.count++);
    updateText(nodes);
    updateStats();
}

function handleContext(d) {
    d3.event.preventDefault();
    //take from adjacent
    d.count += d.adj.length;
    d.adj.forEach(el => el.count--);
    updateText(nodes);
    updateStats();
}

function updateText(sel) {
    sel.select("text")
        .text(d => d.count)
        .classed("negative", d => d.count < 0);
}

var statMoves = document.getElementById("stat-moves");
function updateStats() {
    statMoves.innerHTML++;
}

function resetStats() {
    statMoves.innerHTML = 0;
}

function handleHover(d) {
    var affected = nodes.filter(d1 => d1 === d || d.adj.indexOf(d1) >= 0);
    affected.append("circle")
        .attr("class", "outline")
        .attr("r", 25);
    edges.filter(d1 =>
            (d1.source === d || d1.target === d)
         && affected.data().indexOf(d1.source) >= 0
         && affected.data().indexOf(d1.target) >= 0)
        .classed("highlighted", true);
}

function handleHoverEnd(d) {
    var affected = nodes.filter(d1 => d1 === d || d.adj.indexOf(d1) >= 0);
    affected.select(".outline")
      .remove();
    edges.filter(d1 =>
            (d1.source === d || d1.target === d)
         && affected.data().indexOf(d1.source) >= 0
         && affected.data().indexOf(d1.target) >= 0)
        .classed("highlighted", false);
}

//input event handlers

var inputNodeCount = document.getElementById("input-node-count");
var inputSurplus = document.getElementById("input-surplus");
var inputRange = document.getElementById("input-range");
var generate = document.getElementById("input-generate").onclick = function() {
    var nodeCount = parseInt(inputNodeCount.value, 10);
    var allowSurplus = inputSurplus.checked;
    var range = parseInt(inputRange.value, 10);
    if(nodeCount && nodeCount >= 5 && range && range >= 1) {
        generateGraph(nodeCount, allowSurplus, range);
    }
};

generate();
