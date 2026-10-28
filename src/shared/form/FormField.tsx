import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import type { Ref } from "react";
import type { TextInput, TextInputProps } from "react-native";
import { TextField } from "../ui/TextField";

interface Props<T extends FieldValues> extends Omit<TextInputProps, "value" | "onChangeText" | "style"> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  hint?: string;
  secureToggle?: boolean;
  prefix?: string;
  ref?: Ref<TextInput>;
}

/** A TextField bound to react-hook-form; errors show under the field after a blur or submit. */
export function FormField<T extends FieldValues>({ control, name, ref, ...rest }: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
        <TextField
          ref={ref}
          {...rest}
          value={value ?? ""}
          onChangeText={onChange}
          onBlur={onBlur}
          error={error?.message}
        />
      )}
    />
  );
}
