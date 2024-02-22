import { type Theme, css, useTheme } from "@emotion/react";
import { useState } from "react";

type Primitive = string | number | boolean | null | undefined | symbol | bigint;
type EmptyObject = Record<string, never>;

type CSSInput = Readonly<{
  css: typeof css;
  theme: Theme;
}>;

type ClassNameFunction<TInput extends NonNullable<unknown>> = (
  args: CSSInput & TInput,
) => string; // TEMP!

/**
 * Hook factory for giving you an escape hatch for making Emotion styles.
 *
 * Sometimes you need to combine/collate styles using the className prop in a
 * component, but Emotion does not give you an easy way to define a className
 * and use it from within the same component.
 *
 * Other times, you need to use  inputs that will change on each render to make
 * your styles, but you only want the styles relying on those inputs to be
 * re-computed when the input actually changes. Otherwise, CSS will keep
 * thrashing the <style> tag with diffs each and every render.
 *
 * Also, sometimes just you don't want to think about dependency arrays and
 * stale closure issues.
 *
 * This function solves all three problems. The custom hook it returns will give
 * you a type-safe collection of className values, and auto-memoize all inputs,
 * only re-computing new CSS styles when one of the inputs changes by reference.
 *
 * Making that memoization possible comes with two caveats:
 * 1. All inputs fed into the hook must be primitives. No nested objects or
 *    functions or arrays.
 * 2. All styles defined via the hook are tied to the same memoization cache. If
 *    one of the inputs changes, all classnames for the hook will be
 *    re-computed, even if none of the classnames actually use the input that
 *    changed.
 *
 * If (2) is a performance problem, you can define separate hooks by calling
 * makeClassNames multiple times for each hook you need.
 */
export function makeClassNames<
  THookInput extends Record<string, Primitive> = EmptyObject,
  TConfig extends Record<string, ClassNameFunction<THookInput>> = Record<
    string,
    ClassNameFunction<THookInput>
  >,
>(
  styleConfig: TConfig,
): (hookInput: THookInput) => Record<keyof TConfig, string> {
  type StyleRecord = Record<keyof TConfig, string>;

  const computeNewStyles = (
    theme: Theme,
    hookInput: THookInput,
  ): StyleRecord => {
    const result: Partial<StyleRecord> = {};

    for (const key in styleConfig) {
      const configFunc = styleConfig[key];
      result[key] = configFunc({ css, theme, ...hookInput });
    }

    return result as StyleRecord;
  };

  const didInputsChangeByValue = (
    inputs1: THookInput,
    inputs2: THookInput,
  ): boolean => {
    for (const key in inputs1) {
      const value1 = inputs1[key];
      const value2 = inputs2[key];

      if (Number.isNaN(value1) && Number.isNaN(value2)) {
        continue;
      }

      if (value1 !== value2) {
        return true;
      }
    }

    return false;
  };

  return function useClassNames(hookInputs: THookInput): StyleRecord {
    const activeTheme = useTheme();
    const computeNewCacheValue = () => ({
      theme: activeTheme,
      inputs: hookInputs,
      styles: computeNewStyles(activeTheme, hookInputs),
    });

    const [cache, setCache] = useState(computeNewCacheValue);
    const needNewStyles =
      cache.theme !== activeTheme ||
      didInputsChangeByValue(cache.inputs, hookInputs);

    if (needNewStyles) {
      setCache(computeNewCacheValue());
    }

    return cache.styles;
  };
}

type HookInput = Readonly<{
  paddingTop: number;
  variant: "contained" | "stroked";
}>;

export const useClassNames = makeClassNames<HookInput>({
  class1: ({ css, theme, paddingTop }) =>
    css`
      background-color: red;
      padding: ${theme.spacing(2)};
      padding-top: ${paddingTop}px;
    ` as unknown as string,

  class2: ({ css, variant }) =>
    css`
      color: ${variant === "contained" ? "red" : "blue"};
    ` as unknown as string,
});