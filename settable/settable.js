var canReflect = require("can-reflect");
var ObservationRecorder = require("can-observation-recorder");
var SimpleObservable = require("../can-simple-observable");
var Observation = require("can-observation");
var queues = require("can-queues");
var log = require("../log");
var valueEventBindings = require("can-event-queue/value/value");

var peek = ObservationRecorder.ignore(canReflect.getValue.bind(canReflect));

// This supports an "internal" settable value that the `fn` can derive its value from.
// It's useful to `can-define`.
// ```
// new SettableObservable(function(lastSet){
//   return lastSet * 5;
// }, null, 5)
// ```
function SettableObservable(fn, context, initialValue) {

	this.lastSetValue = new SimpleObservable(initialValue);
	function observe() {
		return fn.call(context, this.lastSetValue.get());
	}
	this.handler = this.handler.bind(this);

	//!steal-remove-start
	canReflect.assignSymbols(this, {
		"can.getName": function() {
			return (
				canReflect.getName(this.constructor) +
				"<" +
				canReflect.getName(fn) +
				">"
			);
		}
	});
	Object.defineProperty(this.handler, "name", {
		value: canReflect.getName(this) + ".handler"
	});
	Object.defineProperty(observe, "name", {
		value: canReflect.getName(fn) + "::" + canReflect.getName(this.constructor)
	});
	//!steal-remove-end

	this.observation = new Observation(observe, this);
}

valueEventBindings(SettableObservable.prototype);

Object.assign(SettableObservable.prototype, {
	// call `obs.log()` to log observable changes to the browser console
	// The observable has to be bound for `.log` to be called
	log: log,
	constructor: SettableObservable,
	handler: function(newVal) {
		var old = this.value;
		this.value = newVal;

		//!steal-remove-start
		if (typeof this._log === "function") {
			this._log(old, newVal);
		}
		//!steal-remove-end

		// adds callback handlers to be called w/i their respective queue.
		queues.enqueueByQueue(
			this.handlers.getNode([]),
			this,
			[newVal, old],
			function() {
				return {};
			}
		);
	},
	onBound: function() {
		this.bound = true;
		canReflect.onValue(this.observation, this.handler, "notify");
		this.value = peek(this.observation);
	},
	onUnbound: function() {
		this.bound = false;
		canReflect.offValue(this.observation, this.handler, "notify");
	},
	set: function(newVal) {
		var oldVal =  this.lastSetValue.get();

		if (canReflect.isObservableLike(oldVal) && canReflect.isValueLike(oldVal)) {
			canReflect.setValue(oldVal, newVal);
		} else {
			if (newVal !== oldVal) {
				this.lastSetValue.set(newVal);
			}
		}
	},
	get: function() {
		if (ObservationRecorder.isRecording()) {
			ObservationRecorder.add(this);
			if (!this.bound) {
				Observation.temporarilyBind(this);
			}
		}

		if (this.bound === true) {
			return this.value;
		} else {
			return this.observation.get();
		}
	},
	hasDependencies: function() {
		return canReflect.valueHasDependencies(this.observation);
	},
	getValueDependencies: function() {
		return canReflect.getValueDependencies(this.observation);
	}
});

canReflect.assignSymbols(SettableObservable.prototype, {
	"can.getValue": SettableObservable.prototype.get,
	"can.setValue": SettableObservable.prototype.set,
	"can.isMapLike": false,
	"can.getPriority": function() {
		return canReflect.getPriority(this.observation);
	},
	"can.setPriority": function(newPriority) {
		canReflect.setPriority(this.observation, newPriority);
	},
	"can.valueHasDependencies": SettableObservable.prototype.hasDependencies,
	"can.getValueDependencies": SettableObservable.prototype.getValueDependencies
});

module.exports = SettableObservable;
