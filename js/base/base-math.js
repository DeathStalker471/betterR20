function baseMath () {
	d20plus.math = {
		vec2: {
			/**
			 * Normalize a 2d vector.
			 * @param out Result storage
			 * @param a Vector to normalise
			 */
			normalize (out, a) {
				const x = a[0];
				const y = a[1];
				let len = x * x + y * y;
				if (len > 0) {
					len = 1 / Math.sqrt(len);
					out[0] = a[0] * len;
					out[1] = a[1] * len;
				}
				return out;
			},

			/**
			 * Scale a 2d vector.
			 * @param out Resulst storage
			 * @param a Vector to scale
			 * @param b Value to scale by
			 */
			scale (out, a, b) {
				out[0] = a[0] * b;
				out[1] = a[1] * b;
				return out;
			},

			/**
			 * Rotate a 2D vector
			 * @param {vec2} out The receiving vec2
			 * @param {vec2} a The vec2 point to rotate
			 * @param {vec2} b The origin of the rotation
			 * @param {Number} c The angle of rotation
			 * @returns {vec2} out
			 */
			rotate (out, a, b, c) {
				// Translate point to the origin
				let p0 = a[0] - b[0];
				let p1 = a[1] - b[1];
				let sinC = Math.sin(c);
				let cosC = Math.cos(c);

				// perform rotation and translate to correct position
				out[0] = p0 * cosC - p1 * sinC + b[0];
				out[1] = p0 * sinC + p1 * cosC + b[1];
				return out;
			},

			/**
			 * Adds two vec2's
			 *
			 * @param {vec2} out the receiving vector
			 * @param {vec2} a the first operand
			 * @param {vec2} b the second operand
			 * @returns {vec2} out
			 */
			add (out, a, b) {
				out[0] = a[0] + b[0];
				out[1] = a[1] + b[1];
				return out;
			},

			/**
			 * Subtracts vector b from vector a
			 *
			 * @param {vec2} out the receiving vector
			 * @param {vec2} a the first operand
			 * @param {vec2} b the second operand
			 * @returns {vec2} out
			 */
			sub (out, a, b) {
				out[0] = a[0] - b[0];
				out[1] = a[1] - b[1];
				return out;
			},

			/**
			 * Computes the cross product of two vec2's
			 * Note that the cross product must by definition produce a 3D vector
			 *
			 * @param {vec3} out the receiving vector
			 * @param {vec2} a the first operand
			 * @param {vec2} b the second operand
			 * @returns {vec3} out
			 */
			cross (out, a, b) {
				let z = a[0] * b[1] - a[1] * b[0];
				out[0] = out[1] = 0;
				out[2] = z;
				return out;
			},

			/**
			 * Multiplies two vec2's
			 *
			 * @param {vec2} out the receiving vector
			 * @param {vec2} a the first operand
			 * @param {vec2} b the second operand
			 * @returns {vec2} out
			 */
			mult (out, a, b) {
				out[0] = a[0] * b[0];
				out[1] = a[1] * b[1];
				return out;
			},

			/**
			 * Calculates the length of a vec2
			 *
			 * @param {vec2} a vector to calculate length of
			 * @returns {Number} length of a
			 */
			len (a) {
				const x = a[0]; const y = a[1];
				return Math.sqrt(x * x + y * y);
			},
		},

		/**
		 * Helper function to determine whether there is an intersection between the two polygons described
		 * by the lists of vertices. Uses the Separating Axis Theorem
		 *
		 * @param a an array of connected points [[x, y], [x, y],...] that form a closed polygon
		 * @param b an array of connected points [[x, y], [x, y],...] that form a closed polygon
		 * @return boolean true if there is any intersection between the 2 polygons, false otherwise
		 */
		doPolygonsIntersect (a, b) {
			const polygons = [a, b];
			let minA, maxA, projected, i, i1, j, minB, maxB;

			for (i = 0; i < polygons.length; i++) {
				// for each polygon, look at each edge of the polygon, and determine if it separates
				// the two shapes
				const polygon = polygons[i];
				for (i1 = 0; i1 < polygon.length; i1++) {
					// grab 2 vertices to create an edge
					const i2 = (i1 + 1) % polygon.length;
					const p1 = polygon[i1];
					const p2 = polygon[i2];

					// find the line perpendicular to this edge
					const normal = [p2[1] - p1[1], p1[0] - p2[0]];

					minA = maxA = undefined;
					// for each vertex in the first shape, project it onto the line perpendicular to the edge
					// and keep track of the min and max of these values
					for (j = 0; j < a.length; j++) {
						projected = normal[0] * a[j][0] + normal[1] * a[j][1];
						if (minA === undefined || projected < minA) minA = projected;
						if (maxA === undefined || projected > maxA) maxA = projected;
					}

					// for each vertex in the second shape, project it onto the line perpendicular to the edge
					// and keep track of the min and max of these values
					minB = maxB = undefined;
					for (j = 0; j < b.length; j++) {
						projected = normal[0] * b[j][0] + normal[1] * b[j][1];
						if (minB === undefined || projected < minB) minB = projected;
						if (maxB === undefined || projected > maxB) maxB = projected;
					}

					// if there is no overlap between the projects, the edge we are looking at separates the two
					// polygons, and we know there is no overlap
					if (maxA < minB || maxB < minA) {
						return false;
					}
				}
			}
			return true;
		},
	};
}

SCRIPT_EXTENSIONS.push(baseMath);
