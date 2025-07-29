
/*
 * Use declaration merging to add the hasOwn property to
 * TypeScript's existing global definition of ObjectConstructor.
 */
interface ObjectConstructor {
  /**
   * Determines whether an object has a property with the specified name.
   * @param o An object.
   * @param v A property name.
   */
  hasOwn(o: object, v: PropertyKey): boolean
}

interface Array<T> {
  /**
   * Takes an integer value and returns the item at that index,
   * allowing for positive and negative integers. Negative integers
   * count back from the last item in the array.
   */
  at(index: number): T | undefined
}
