var canKey = require("can-key");
var canKeyUtils = require("can-key/utils");
var canReflect = require("can-reflect");
var canReflectDependencies = require("can-reflect-dependencies");
var Observation = require("can-observation");

module.exports = function keyObservable(root, keyPath) {
	var keyPathParts = canKeyUtils.parts(keyPath);

	// Some variables used to build the dependency/mutation graph
	//!steal-remove-start
	var lastIndex = keyPathParts.length - 1;
	var lastKey;// This stores the last part of the keyPath, e.g. “key” in “outer.inner.key”
	var lastParent;// This stores the object that the last key is on, e.g. “outer.inner” in outer: {inner: {"key": "value"}}
	//!steal-remove-end

	var observation = new Observation(function() {
		var value;

		// This needs to be walked every time because the objects along the key path might change
		canKey.walk(root, keyPathParts, function(keyData, i) {
			if (i === lastIndex) {
				//!steal-remove-start
				// observation is mutating keyData.parent
				if (lastParent && (keyData.key !== lastKey || keyData.parent !== lastParent)) {
					canReflectDependencies.deleteMutatedBy(lastParent, lastKey, observation);
				}
				lastKey = keyData.key;
				lastParent = keyData.parent;
				canReflectDependencies.addMutatedBy(lastParent, lastKey, observation);
				//!steal-remove-end

				value = keyData.value;
			}
		});

		return value;
	});

	return canReflect.assignSymbols(observation, {
		//!steal-remove-start
		"can.getName": function getName() {
			var objectName = canReflect.getName(root);
			return "keyObservable<" + objectName + "." + keyPath + ">";
		},
		//!steal-remove-end

		// Register what this observable changes
		//!steal-remove-start
		"can.getWhatIChange": function getWhatIChange() {
			return {
				mutate: {
					keyDependencies: new Map([
						[lastParent, new Set([lastKey])]
					])
				}
			};
		},
		//!steal-remove-end

		"can.setValue": function(newVal) {
			canKey.set(root, keyPathParts, newVal);
		}
	});
}
