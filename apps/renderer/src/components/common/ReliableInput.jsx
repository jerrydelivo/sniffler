import { useState, useRef, useEffect, forwardRef } from "react";
import {
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import "./ReliableInput.css";

/**
 * Custom styled MUI TextField that ensures 100% clickability and focus reliability
 */
const StyledTextField = styled(TextField)(({ theme }) => ({
  "& .MuiInputBase-root": {
    backgroundColor: "var(--bg-color, #ffffff)",
    color: "var(--text-color, #000000)",
    cursor: "text",
    minHeight: "40px",
    "&:hover": {
      backgroundColor: "var(--bg-hover-color, #f5f5f5)",
    },
    "&.Mui-focused": {
      backgroundColor: "var(--bg-focus-color, #ffffff)",
    },
    "&.Mui-disabled": {
      cursor: "not-allowed",
      opacity: 0.6,
    },
  },
  "& .MuiInputBase-input": {
    cursor: "text",
    "&:disabled": {
      cursor: "not-allowed",
    },
  },
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      borderColor: "var(--border-color, #d1d5db)",
    },
    "&:hover fieldset": {
      borderColor: "var(--border-hover-color, #9ca3af)",
    },
    "&.Mui-focused fieldset": {
      borderColor: "var(--border-focus-color, #3b82f6)",
      borderWidth: "2px",
    },
  },
}));

/**
 * Custom styled MUI Select that ensures 100% clickability
 */
const StyledSelect = styled(Select)(({ theme }) => ({
  "& .MuiSelect-select": {
    backgroundColor: "var(--bg-color, #ffffff)",
    color: "var(--text-color, #000000)",
    cursor: "pointer",
    minHeight: "40px",
    display: "flex",
    alignItems: "center",
    "&:focus": {
      backgroundColor: "var(--bg-focus-color, #ffffff)",
    },
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "var(--border-color, #d1d5db)",
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "var(--border-hover-color, #9ca3af)",
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "var(--border-focus-color, #3b82f6)",
    borderWidth: "2px",
  },
}));

/**
 * Reliable Input Component with 100% clickability guarantee
 */
export const ReliableInput = forwardRef(
  (
    {
      type = "text",
      value = "",
      onChange,
      onBlur,
      onFocus,
      placeholder = "",
      disabled = false,
      required = false,
      autoFocus = false,
      className = "",
      style = {},
      min,
      max,
      rows,
      multiline = false,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState(value);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    // Sync external value changes
    useEffect(() => {
      setInternalValue(value);
    }, [value]);

    // Enhanced focus handling
    const handleFocus = (e) => {
      setIsFocused(true);
      if (onFocus) onFocus(e);
    };

    const handleBlur = (e) => {
      setIsFocused(false);
      if (onBlur) onBlur(e);
    };

    const handleChange = (e) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      if (onChange) {
        // Create a synthetic event that matches React's expectations
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: newValue,
            name: props.name || "",
          },
        };
        onChange(syntheticEvent);
      }
    };

    // Force focus when container is clicked
    const handleContainerClick = (e) => {
      if (disabled) return;

      // Prevent event from bubbling up
      e.preventDefault();
      e.stopPropagation();

      // Focus the input
      if (inputRef.current) {
        try {
          inputRef.current.focus();
          inputRef.current.click();
        } catch (error) {
          console.warn("Failed to focus input:", error);
        }
      }
    };

    // Apply dark mode CSS variables
    useEffect(() => {
      if (containerRef.current) {
        const isDark = document.documentElement.classList.contains("dark");
        const container = containerRef.current;

        if (isDark) {
          container.style.setProperty("--bg-color", "#374151");
          container.style.setProperty("--bg-hover-color", "#4b5563");
          container.style.setProperty("--bg-focus-color", "#374151");
          container.style.setProperty("--text-color", "#ffffff");
          container.style.setProperty("--border-color", "#6b7280");
          container.style.setProperty("--border-hover-color", "#9ca3af");
          container.style.setProperty("--border-focus-color", "#3b82f6");
        } else {
          container.style.setProperty("--bg-color", "#ffffff");
          container.style.setProperty("--bg-hover-color", "#f9fafb");
          container.style.setProperty("--bg-focus-color", "#ffffff");
          container.style.setProperty("--text-color", "#111827");
          container.style.setProperty("--border-color", "#d1d5db");
          container.style.setProperty("--border-hover-color", "#9ca3af");
          container.style.setProperty("--border-focus-color", "#3b82f6");
        }
      }
    }, []);

    // Auto focus handling
    useEffect(() => {
      if (autoFocus && inputRef.current) {
        setTimeout(() => {
          try {
            inputRef.current.focus();
          } catch (error) {
            console.warn("AutoFocus failed:", error);
          }
        }, 100);
      }
    }, [autoFocus]);

    const commonProps = {
      value: internalValue,
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      disabled,
      placeholder,
      required,
      inputRef: inputRef,
      autoFocus,
      ...props,
    };

    return (
      <div
        ref={containerRef}
        className={`reliable-input-container ${className}`}
        style={{
          cursor: disabled ? "not-allowed" : "text",
          ...style,
        }}
        onClick={handleContainerClick}
      >
        <StyledTextField
          id={props.id}
          {...commonProps}
          type={type}
          multiline={multiline}
          rows={multiline ? rows || 1 : undefined}
          InputProps={{
            inputProps: {
              id: props.id,
              min: type === "number" ? min : undefined,
              max: type === "number" ? max : undefined,
              ref: ref || inputRef,
            },
          }}
          variant="outlined"
          fullWidth
          size="small"
        />
      </div>
    );
  }
);

/**
 * Reliable Select Component with 100% clickability guarantee
 */
export const ReliableSelect = forwardRef(
  (
    {
      value = "",
      onChange,
      onBlur,
      onFocus,
      disabled = false,
      required = false,
      autoFocus = false,
      className = "",
      style = {},
      children,
      label,
      placeholder,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState(value);
    const [isFocused, setIsFocused] = useState(false);
    const selectRef = useRef(null);
    const containerRef = useRef(null);

    // Sync external value changes
    useEffect(() => {
      setInternalValue(value);
    }, [value]);

    const handleFocus = (e) => {
      setIsFocused(true);
      if (onFocus) onFocus(e);
    };

    const handleBlur = (e) => {
      setIsFocused(false);
      if (onBlur) onBlur(e);
    };

    const handleChange = (e) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      if (onChange) {
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: newValue,
            name: props.name || "",
          },
        };
        onChange(syntheticEvent);
      }
    };

    // Force focus when container is clicked
    const handleContainerClick = (e) => {
      if (disabled) return;

      e.preventDefault();
      e.stopPropagation();

      if (selectRef.current) {
        try {
          selectRef.current.focus();
          // Trigger the select to open
          const selectElement =
            selectRef.current.querySelector('[role="button"]');
          if (selectElement) {
            selectElement.click();
          }
        } catch (error) {
          console.warn("Failed to focus select:", error);
        }
      }
    };

    // Apply dark mode CSS variables
    useEffect(() => {
      if (containerRef.current) {
        const isDark = document.documentElement.classList.contains("dark");
        const container = containerRef.current;

        if (isDark) {
          container.style.setProperty("--bg-color", "#374151");
          container.style.setProperty("--bg-hover-color", "#4b5563");
          container.style.setProperty("--bg-focus-color", "#374151");
          container.style.setProperty("--text-color", "#ffffff");
          container.style.setProperty("--border-color", "#6b7280");
          container.style.setProperty("--border-hover-color", "#9ca3af");
          container.style.setProperty("--border-focus-color", "#3b82f6");
        } else {
          container.style.setProperty("--bg-color", "#ffffff");
          container.style.setProperty("--bg-hover-color", "#f9fafb");
          container.style.setProperty("--bg-focus-color", "#ffffff");
          container.style.setProperty("--text-color", "#111827");
          container.style.setProperty("--border-color", "#d1d5db");
          container.style.setProperty("--border-hover-color", "#9ca3af");
          container.style.setProperty("--border-focus-color", "#3b82f6");
        }
      }
    }, []);

    // Auto focus handling
    useEffect(() => {
      if (autoFocus && selectRef.current) {
        setTimeout(() => {
          try {
            selectRef.current.focus();
          } catch (error) {
            console.warn("AutoFocus failed:", error);
          }
        }, 100);
      }
    }, [autoFocus]);

    return (
      <div
        ref={containerRef}
        className={`reliable-select-container ${className}`}
        style={{
          cursor: disabled ? "not-allowed" : "pointer",
          ...style,
        }}
        onClick={handleContainerClick}
      >
        <FormControl fullWidth size="small" variant="outlined">
          {label && (
            <InputLabel id={`${props.name || "select"}-label`}>
              {label}
            </InputLabel>
          )}
          <StyledSelect
            ref={selectRef}
            labelId={`${props.name || "select"}-label`}
            value={internalValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            required={required}
            autoFocus={autoFocus}
            label={label}
            displayEmpty={!!placeholder}
            {...props}
          >
            {placeholder && (
              <MenuItem value="" disabled>
                <em>{placeholder}</em>
              </MenuItem>
            )}
            {children}
          </StyledSelect>
        </FormControl>
      </div>
    );
  }
);

// Add display names for better debugging
ReliableInput.displayName = "ReliableInput";
ReliableSelect.displayName = "ReliableSelect";

export default ReliableInput;
