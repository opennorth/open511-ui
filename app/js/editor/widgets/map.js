O5.widgets.map = O5.widgets.BaseWidget.extend({
	
	tagName: 'div',
	geom: null,
	events: {},

	geomType: function() {
		if (!this.geom) {
			return null;
		}
		return this.geom.type;
	},

	initialize: function() {
		// Event handlers
		var self = this;
		this.$el.on('click', '.draw-clear', function(e) {
			e.preventDefault();
			self.geom = null;
			self.trigger('change');
			self.render();
		}).on('click', '.draw-point', function(e) {
			e.preventDefault();
			self.startDrawing('point');
		}).on('click', '.draw-line', function(e) {
			e.preventDefault();
			self.startDrawing('line');
		});
		this.render();
	},

	startDrawing: function(type) {
		O5.app.map.startDrawing(type);
		O5.app.map.off('draw', this.saveDrawing);
		O5.app.map.on('draw', this.saveDrawing, this);
	},

	saveDrawing: function(gj) {
		this.geom = gj;
		O5.app.map.stopDrawing();
		this.render();
		this.onChange();
	},

	render: function() {
		this.$el.html(JST.map_edit_widget(this));
	},

	setVal: function(val) {
		this.geom = val;
		this.render();
	},

	getVal: function() {
		return this.geom;
	}
});