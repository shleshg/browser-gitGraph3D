class Canvas {
	graph;
	canvas;
	deadInside;
	clientX;
	clientY;
	textCanvas;
	GL;
	fullBuffer;
	vertexBuffer;
	indexBuffer;
	colorBuffer;
	normalBuffer;
	indexBufferEdges;
	modelUniform;
	viewUniform;
	normalModelUniform;
	font;
	graphProgram;
	edgeProgram;
	fps;
	fpsAvg;
	res;

	constructor(updates) {
		this.canvas = document.getElementById('graph');
		this.textCanvas = document.getElementById('text-canvas');
		this.textCanvas.onmouseleave = () => {
			this.deadInside = false;
		};
		this.textCanvas.onmousemove = (ev) => {
			this.deadInside = true;
			const w = this.textCanvas.width, h = this.textCanvas.height;
			this.clientX = (ev.clientX - (w / 2)) / (w / 2);
			this.clientY = ((h / 2) - ev.clientY) / (h / 2);
		};
		this.resize();
		this.GL = this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl");
		if (!this.GL) {
			alert('init gl fail');
		}
		if (this.GL) {
			this.GL.clearColor(1.0, 1.0, 1.0, 1.0);
			this.GL.enable(this.GL.DEPTH_TEST);
			this.GL.depthFunc(this.GL.LEQUAL);
			this.GL.enable(this.GL.BLEND);
			this.GL.blendFunc(this.GL.SRC_ALPHA, this.GL.ONE_MINUS_SRC_ALPHA);
			this.GL.clear(this.GL.COLOR_BUFFER_BIT | this.GL.DEPTH_BUFFER_BIT);
			this.GL.getExtension('OES_element_index_uint');
		}
		this.fps = [];
		this.res = [];
		
		this.graphProgram = new Program(this.GL, 'vertex-shader', 'fragment-shader');
		this.edgeProgram = new Program(this.GL, 'vertex-simple-shader', 'fragment-shader');

		this.vertexBuffer = this.GL.createBuffer();
		this.indexBuffer = this.GL.createBuffer();
		this.indexBufferEdges = this.GL.createBuffer();
		this.colorBuffer = this.GL.createBuffer();
		this.normalBuffer = this.GL.createBuffer();
		this.fullBuffer = this.GL.createBuffer();

		this.graph = new Graph(updates);
	}
	
	clear = () => {
		this.GL.clearColor(0.09, 0.09, 0.09, 1.0);
		this.GL.clear(this.GL.COLOR_BUFFER_BIT | this.GL.DEPTH_BUFFER_BIT);
	};

	calcFont = () => {
		const width = this.canvas.width;
		if (width < 500) {
			this.font = 12;
		} else if (width < 800) {
			this.font = 14;
		} else if (width < 1000) {
			this.font = 16;
		} else if (width < 1200) {
			this.font = 18;
		} else if (width < 1400) {
			this.font = 20;
		} else if (width < 1600) {
			this.font = 22;
		} else if (width < 2000) {
			this.font = 24;
		} else {
			this.font = 28;
		}
	};

	draw = (model, view, normalModel, delta, begin, deltaFps) => {
		this.graphProgram.use(true);
		let name;
		this.GL.clear(this.GL.COLOR_BUFFER_BIT | this.GL.DEPTH_BUFFER_BIT);
		this.modelUniform = this.graphProgram.getUniformLocation('model');
		this.viewUniform = this.graphProgram.getUniformLocation('view');
		this.normalModelUniform = this.graphProgram.getUniformLocation('normalModel');
		this.GL.uniformMatrix4fv(this.modelUniform, false, model);
		this.GL.uniformMatrix4fv(this.viewUniform, false, view);
		this.GL.uniformMatrix4fv(this.normalModelUniform, false, normalModel);

		if (!this.fpsAvg) {
			this.fpsAvg = deltaFps;
		}
		this.graph.iterate(delta);
		if (this.deadInside) {
			name = this.graph.getName(this.clientX, this.clientY, this.textCanvas.height/this.textCanvas.width, model, view);
		}
		this.initBuffers();

		this.writeDate(begin, this.clientX, this.clientY, name, deltaFps);

		this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.fullBuffer);
		this.GL.vertexAttribPointer(this.graphProgram.vertexAttrib, 4, this.GL.FLOAT, true, VERTEX_ATTR*4, 0);
		this.GL.vertexAttribPointer(this.graphProgram.colorAttrib, 4, this.GL.FLOAT, true, VERTEX_ATTR*4, 16);
		this.GL.vertexAttribPointer(this.graphProgram.normalAttrib, 3, this.GL.FLOAT, true, VERTEX_ATTR*4, 32);
		this.GL.bindBuffer(this.GL.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
		this.GL.drawElements(this.GL.TRIANGLES, this.graph.indices.length, this.GL.UNSIGNED_INT, 0);

		this.edgeProgram.use();
		this.modelUniform = this.edgeProgram.getUniformLocation('model');
		this.viewUniform = this.edgeProgram.getUniformLocation('view');
		this.GL.uniformMatrix4fv(this.modelUniform, false, model);
		this.GL.uniformMatrix4fv(this.viewUniform, false, view);
		this.GL.bindBuffer(this.GL.ELEMENT_ARRAY_BUFFER, this.indexBufferEdges);

		this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.fullBuffer);
		this.GL.vertexAttribPointer(this.graphProgram.vertexAttrib, 4, this.GL.FLOAT, true, VERTEX_ATTR*4, 0);
		this.GL.vertexAttribPointer(this.graphProgram.colorAttrib, 4, this.GL.FLOAT, true, VERTEX_ATTR*4, 16);
		this.GL.bindBuffer(this.GL.ELEMENT_ARRAY_BUFFER, this.indexBufferEdges);
		
		this.GL.drawElements(this.GL.LINES, this.graph.edgeIndices.length, this.GL.UNSIGNED_INT, 0);

		this.GL.drawArrays(this.GL.LINES, this.graph.buf.length / VERTEX_ATTR, this.graph.edgeBuf.length / VERTEX_ATTR);
	};
	
	initBuffers = () => {
		this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.fullBuffer);
		this.GL.bufferData(this.GL.ARRAY_BUFFER, new Float32Array(this.graph.buf.concat(this.graph.edgeBuf)), this.GL.DYNAMIC_DRAW);

		this.GL.bindBuffer(this.GL.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
		this.GL.bufferData(this.GL.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.graph.indices), this.GL.DYNAMIC_DRAW);

		this.GL.bindBuffer(this.GL.ELEMENT_ARRAY_BUFFER, this.indexBufferEdges);
		this.GL.bufferData(this.GL.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.graph.edgeIndices), this.GL.DYNAMIC_DRAW);
	};
	resize = () => {
		this.canvas.width = this.canvas.parentNode.getBoundingClientRect().width;
		this.canvas.height = this.canvas.parentNode.getBoundingClientRect().height;
		this.textCanvas.width = this.canvas.parentNode.getBoundingClientRect().width;
		this.textCanvas.height = this.canvas.parentNode.getBoundingClientRect().height;
		this.calcFont();
		if (this.GL) {
			this.GL.viewport(0, 0, this.canvas.width, this.canvas.height);
		}
	};
	writeDate = (date, clientX, clientY, name, delta) => {
		const w = this.textCanvas.width;
		const d = new Date(date);
		const dateString = d.toISOString();
		const ctx = this.textCanvas.getContext('2d');
		ctx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);
		ctx.fillStyle = '#FF0000';
		ctx.font = this.font + 'px serif';
		const textWidth = ctx.measureText(dateString).width;
		const pos = (w / 2) - (textWidth / 2);
		this.fps.push(delta);
		if (this.fps.length === 10) {
			this.fpsAvg = this.fps.reduce((sum, current, ind, x) => sum + current, 0)/10;
			if (this.res.length !== 0) {
				if (this.res[this.res.length-1][1] !== this.graph.buf.length/VERTEX_ATTR/(VERTEX_SIZE+SKIP_COORDS)) {
					this.res.push([Math.round(1000/this.fpsAvg), this.graph.buf.length/VERTEX_ATTR/(VERTEX_SIZE+SKIP_COORDS), 1]);
				} else {
					this.res[this.res.length-1][0] += Math.round(1000/this.fpsAvg);
					this.res[this.res.length-1][2]++;
				}
			} else {
				this.res.push([Math.round(1000/this.fpsAvg), this.graph.buf.length/VERTEX_ATTR/(VERTEX_SIZE+SKIP_COORDS), 1]);
			}
			this.fps = [];
		}
		ctx.fillText(dateString, pos, this.font);
		ctx.fillStyle = '#AAAA00';
		ctx.fillText(Math.round(1000/this.fpsAvg).toFixed(0), 0, this.font);
		if (name) {
			clientX = (clientX + 1) * this.textCanvas.width / 2;
			clientY = (-clientY + 1) * this.textCanvas.height / 2;
			const nameWidth = ctx.measureText(name).width;
			if (clientX + nameWidth > w) {
				clientX = w - nameWidth - 3;
			}
			ctx.fillStyle = '#202020';
			ctx.strokeStyle = '#FF0000';
			ctx.fillRect(clientX, clientY - this.font, nameWidth + 3, this.font);
			ctx.strokeRect(clientX, clientY - this.font, nameWidth + 3, this.font);
			ctx.fillStyle = '#FF0000';
			ctx.fillText(name, clientX, clientY);
		}
	};

	resToString = () => {
		return this.res
			.map((v) => [Math.round(v[0]/v[2]), v[1]])
			.map((v) => '' + v[1] + ',' + v[0])
			.reduce((prev, next) => prev + '\n' + next, '\'Количество вершин\',\'fps\'');
	};
	saveRes = () => {
		const pom = document.createElement('a');
		pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(this.resToString()));
		pom.setAttribute('download', 'res.csv');
		if (document.createEvent) {
			const event = document.createEvent('MouseEvents');
			event.initEvent('click', true, true);
			pom.dispatchEvent(event);
		} else {
			pom.click();
		}
	};
	
	isEnd = () => {
		return this.graph.isEnd();
	};

	checkSkip = () => {
		return this.graph.checkSkip();
	};

	iterate = (delta) => {
		return this.graph.iterate(delta);
	};

	get width() {
		return this.canvas.width;
	}

	get height() {
		return this.canvas.height;
	}

	set graph(graph) {
		this.graph = graph;
	}
}
