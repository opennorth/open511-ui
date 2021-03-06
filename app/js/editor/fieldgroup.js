(function() {

	/**
	 * A FieldGroup is a series of editable fields in the editor.
	 * Groups can be nested inside groups.
	 */
	O5.editor.FieldGroup = O5.views.BaseView.extend({
		className: 'fieldgroup field',

		initialize: function() {
			O5.views.BaseView.prototype.initialize.call(this);
			this.widgets = {};
			this.widgetList = [];
			if (this.options.tab) this.$el.attr('data-tab', this.options.tab);
			var self = this;
			_.each(this.options.fields, function(field) {
				var item = self._makeWidget(field);
				self.widgets[field.name] = item;
				self.widgetList.push(item);
				item.on('change', function(opts) {
					self.onWidgetChange(item, opts);
				});
			});
		},

		renderEditorField: function() {
			var self = this;
			_.each(this.widgetList, function(widget) {
				self.$el.append(widget.renderEditorField());
			});
			return self.$el;
		},

		// Returns a dict of all the values entered into this group's widgets
		getVal: function() {
			var updates = {};
			_.each(this.widgets, function (widget) {
				_.each(widget.getVals(), function(val, key) {
					if (val === '' || (val && val.length === 0)) val = null;
					// This is done so that 'schedule/startDate' goes to {'schedule': {'startDate': x }}
					var name_bits = key.split('/');
					var base = updates;
					while (name_bits.length > 1) {
						var bit = name_bits.shift();
						if (!base[bit]) {
							base[bit] = {};
						}
						base = base[bit];
					}
					base[name_bits[0]] = val;
				});
			});
			return updates;
		},

		getVals: function() {
			var vals = {};
			vals[this.options.name || 'fieldgroup'] = this.getVal();
			return vals;
		},

		setVal: function(val) {
			_.each(this.widgets, function(widget, name) {
				var base = val;
				var name_bits = name.split('/');
				while (name_bits.length > 1) {
					base = base[name_bits.shift()] || {};
				}
				var v = base[name_bits[0]];
				if (v) widget.setVal(v);
			});
		},

		displayValidationError: function(message) {
			this.$el.find('.validation-error').remove();
			if (message) {
				var $msg = $('<span class="emphasized-note error validation-error" />');
				$msg.text(message);
				this.$el.prepend($msg);
			}
		},

		// Should return true if the field is valid, an error message if not
		checkValidation: function(opts) {
			if (this.options.validate) {
				return this.options.validate(this.getVal(), opts);
			}
			return true;
		},

		// Returns an array of every widget failing validation;
		// also triggers display of validation errors
		getInvalidWidgets: function(opts) {
			var invalid = [];
			_.each(this.widgetList, function (widget) {
				invalid.push.apply(invalid, widget.getInvalidWidgets(opts));
			});
			var result = this.checkValidation(opts);
			if (result !== true) {
				var target = result.field ? this.widgets[result.field] : this;
				target.displayValidationError(result.error ? result.error : result);
				invalid.push(this);
			}
			return invalid;
		},

		_makeWidget: function(field) {
			var wc;

			if (field.repeating) {
				wc = O5.editor.RepeatingFieldGroup;
			}
			else if (field.widget) {
				if (_.isObject(field.widget)) {
					wc = field.widget;
				}
				else {
					wc = O5.widgets[field.widget];
				}
			}
			else if (field.type === 'text') {
				wc = O5.widgets.textarea;
			}
			else if (field.type === 'enum' && field.choices) {
				wc = O5.widgets.select;
			}
			else if (field.type === 'date') {
				wc = O5.widgets.date;
			}
			else if (field.type === 'time') {
				wc = O5.widgets.time;
			}
			else if (field.type === 'group') {
				wc = O5.editor.FieldGroup;
			}
			else {
				wc = O5.widgets.text;
			}

			var opts = _.extend({
				app: this.app,
				roadEvent: this.options.roadEvent
			}, field);
			return new wc(opts);

		},

		// Bubble change events upwards
		onWidgetChange: function(widget, opts) {
			this.trigger('change', opts);
		}


	});

	/**
	 * The top-level group containing all other fields & groups.
	 */
	O5.editor.TopLevelFieldGroup = O5.editor.FieldGroup.extend({

		onWidgetChange: function(widget, opts) {

			if (widget.getInvalidWidgets({}).length === 0) {
				var self = this;
				_.each(widget.getVals(), function(val, name) {
					if (name.indexOf('/') === -1) {
						// FIXME doesn't currently support slash-nested names
						self.options.roadEvent.set(name, val);
					}
				});
			}

		}

	});

	/**
	 * Represents a FieldGroup that can recur multiple times -- e.g. the group
	 * represents a road, and an event can have many different roads.
	 */
	O5.editor.RepeatingFieldGroup = O5.editor.FieldGroup.extend({
		className: 'repeating-group field',

		initialize: function() {
			O5.views.BaseView.prototype.initialize.call(this);
			_.defaults(this.options, {
				addSeparators: true,
				initialEmptyRows: 1,
				displayLabel: true
			});

			this.widgetList = [];
			if (this.options.addSeparators) this.$el.addClass('with-separators');
			if (this.options.tab) this.$el.attr('data-tab', this.options.tab);
			if (this.options.label && this.options.displayLabel)
				this.$el.append($(document.createElement('label')).text(this.options.label));
			this.$rows = $('<div class="repeating-group-rows"></div>');
			this.$el.append(this.$rows);
			this.renderRows(this.options.initialEmptyRows);

			if (!this.options.autoAddRows) this.renderAddRow();

		},

		renderAddRow: function() {
			var self = this;
			this.$el.on('click', '.add-row', function() { self.addRow(); });
			this.$el.append($('<a class="add-row">+</a>'));
		},

		renderEditorField: function() {
			return this.$el;
		},

		renderRows: function(rows) {
			this.$rows.empty();
			this.widgetList = []; // FIXME clear events on former widgets?
			for (var i = 0; i < rows; i ++) {
				this.addRow();
			}
		},

		addRow: function(widgetOpts) {
			var item = this._makeWidget(widgetOpts || _.extend({}, this.options, {repeating: false}));
			var self = this;
			item.on('change', function(opts) {
				self.onWidgetChange(item, opts);
			});
			this.widgetList.push(item);
			this.$rows.append(item.renderEditorField());
			return item;
		},

		onWidgetChange: function(item, opts) {
			if (this.options.autoAddRows) this.autoAddRow();
			O5.editor.FieldGroup.prototype.onWidgetChange.call(this);
		},

		// Add another row if all current rows are full
		autoAddRow: function() {
			if (this._isFull()) this.addRow();
		},

		getVal: function() {
			var val = [];
			var self = this;
			_.each(this.widgetList, function(widget) {
				var wval = widget.getVal();
				if (!self._isEmptyValue(wval)) val.push(wval);
			});
			if (val.length === 0) return null;
			return val;
		},

		// Is this either a nullish value or an object containing only nullish values?
		_isEmptyValue: function(wval) {
			if (_.isArray(wval)) return _.every(wval, this._isEmptyValue);
			return !(_.isObject(wval) ? _.any(wval, function(v) { return v === 0 || v; }) : (wval === 0 || wval));
		},

		// Are all current rows full?
		_isFull: function() {
			var self = this;
			return _.all(this.widgetList, function(widget) {
				return !self._isEmptyValue(widget.getVal()) && self.getInvalidWidgets().length === 0;
			});
		},

		getVals: function() {
			var vals = {};
			vals[this.options.name || 'fieldgroup'] = this.getVal();
			return vals;
		},

		setVal: function(val) {
			if (!val) val = [{}];
			if (this.widgetList.length !== val.length) {
				this.renderRows(val.length);
			}
			for (var i = 0; i < val.length; i++) {
				this.widgetList[i].setVal(val[i]);
			}
			if (this.options.autoAddRows) this.autoAddRow();
		},

		checkValidation: function() {
			return true;
		},

		// Returns an array of every widget failing validation;
		// also triggers display of validation errors
		getInvalidWidgets: function(opts) {
			var invalid = [];
			var self = this;
			_.each(this.widgetList, function (widget) {
				if (!self._isEmptyValue(widget.getVal())) {
					// If it's an empty row, don't validate it
					invalid.push.apply(invalid, widget.getInvalidWidgets(opts));
				}
			});
			if (this.options.required && invalid.length === 0 && this._isEmptyValue(this.getVal())) {
				// We're required and don't have a value
				// invalid.push.apply(invalid, this.widgetList[0].getInvalidWidgets(opts));
				this.displayValidationError(O5._t("This field is required"));
				invalid.push(this);
			}
			var result = this.checkValidation(opts);
			if (result !== true) {
				this.displayValidationError(result);
				invalid.push(this);
			}
			return invalid;
		},


	});
})();