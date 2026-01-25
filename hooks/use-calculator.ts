import { useAuthStore } from "@/store/auth";
import api from "@/utils/axios";
import { config } from "@/utils/config";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useState } from "react";


/**
 * You should implement this function later to call the API endpoint
 * that receives { calculate_str, secret_pin }.
 */
const verifySecretPin = async (calculate_str: string, secret_pin: string) => {
  console.log("calculate_str", calculate_str, "secret_pin", secret_pin)
  await login(calculate_str, secret_pin)
  // TODO: Replace this with the real API call
  // Example:
  // return await api.post("/user/verify-secret-pin/", { calculate_str, secret_pin });
  // For now, just simulate:
  // return Promise.resolve({ success: true });
};

export const useCalculator = () => {
  const [display, setDisplay] = useState("0");
  const [firstOperand, setFirstOperand] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForSecondOperand, setWaitingForSecondOperand] = useState(false);
  const [secondOperand, setSecondOperand] = useState<string | null>(null);
  const [equation, setEquation] = useState<string>(""); // Holds a matched calculation string if matched
  const [pinInput, setPinInput] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const { setUser, setToken } = useAuthStore()

  const login = async (payload: { calculate_str: string, secret_pin: string }) => {
    console.log("on LOGIN")
    try {
      // Determine login endpoint and user-type header based on config.userType
      let loginUrl = "";
      let userTypeHeader = config.userType;

      switch (config.userType) {
        case "ADMIN":
          loginUrl = `${config.apiBaseUrl}/administrator/login/`;
          break;
        case "AGENT":
          loginUrl = `${config.apiBaseUrl}/agent/login/`;
          break;
        case "DEALER":
        default:
          loginUrl = `${config.apiBaseUrl}/dealer/login/`;
          break;
      }

      const response = await fetch(
        loginUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Type": userTypeHeader,
          },
          body: JSON.stringify(payload),
        }
      );
      console.log("resp", response)


      const data = await response.json();
      console.log("data", data)
      // if (config.userType !== data?.user_details?.user_type) {
      //   router.push("/login")
      // }
      console.log("data", data);
      // set({
      //   user: {
      //     id: data.user_details?.user_id,
      //     user_type: config.userType,
      //     superuser: data?.user_details?.superuser || false,
      //     ...data?.user_details
      //   },
      //   token: data.access,
      //   loading: false,
      //   error: null,
      // });
      console.log("datad", data, data?.non_field_errors, data?.non_field_errors?.length)
      if(data?.non_field_errors || data?.non_field_errors?.length > 0){
        console.log("inside if")
        // return false
      }else {
        console.log("on else")
      setToken(data.access)
      setUser({
        id: data.user_details?.user_id,
        user_type: config.userType,
        superuser: data?.user_details?.superuser || false,
        ...data?.user_details
      });
      console.log("navigating..")
        router.push("/(tabs)");
      return true
    }


    } catch (err: any) {
      console.log("err", err);
      // set({ error: err.message || "Login failed", loading: false });
      return false
    }
  }

  const {
    data: equationData,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ["/user/get-initial-user-creds/"],
    queryFn: async () => {
      try {
        const res = await api.get("/user/get-initial-user-creds/", {
          headers: {
            "User-Type": config.userType
          }
        });
        console.log("data", res.data)
        // return  ["11-89", "22-2", "8+133"]
        // Response: ["11-89", "22-2", "8+133"], etc.
        return res.data;
      } catch (error: any) {
        let errorMsg = "An error occurred while fetching user credentials.";
        if (error.response) {
          const { status, data } = error.response;
          if (data && typeof data === "object" && data.message) {
            errorMsg = data.message;
          } else if (typeof data === "string") {
            errorMsg = data;
          } else {
            errorMsg = `Error: ${status}`;
          }
        } else if (error.message) {
          errorMsg = error.message;
        }
        throw new Error(errorMsg);
      }
    },
  });

  console.log("equationData", equationData)

  // Check if the calculation matches a string from API, then allow pin entry
  const handleEqual = useCallback(async () => {
    console.log("on equal")
    // If we are currently at the PIN entry phase, verify the PIN here!
    if (equation) {
      // if (pinInput.length < 4) {
      //   setPinError("PIN must be at least 4 digits.");
      //   return;
      // }
      setIsVerifyingPin(true);
      setPinError(null);
      try {
        const response = await login({ calculate_str: equation, secret_pin: pinInput });
        // console.log("res",response)
        // if (response) {
        //   setDisplay("0");
        //   setPinInput("");
        //   setEquation("");
        //   setIsVerifyingPin(false);
        // } else {
        //   setPinError("Invalid PIN. Please try again.");
        //   setPinInput("");
        //   setIsVerifyingPin(false);
        // }
      } catch (e: any) {
        setPinError(e?.message || "Failed to verify PIN.");
        setIsVerifyingPin(false);
        setPinInput("");
      }
      return;
    }

    if (!operator || firstOperand === null) return;

    const inputValue = parseFloat(display);
    const result = performCalculation(operator, firstOperand, inputValue);

    const equationStr = `${firstOperand}${operator}${secondOperand ?? display}`;

    if (Array.isArray(equationData) && equationData.includes(equationStr)) {
      setDisplay(""); // Clear display for PIN entry
      setFirstOperand(null);
      setOperator(null);
      setWaitingForSecondOperand(false);
      setSecondOperand(null);
      setEquation(equationStr); // Save the equation string to use as calculate_str
      setPinInput(""); // Ready for PIN input
      setPinError(null);
    } else {
      setDisplay(String(result));
      setFirstOperand(result);
      setOperator(null);
      setWaitingForSecondOperand(true);
      setSecondOperand(null);
    }
  }, [display, firstOperand, operator, secondOperand, equationData, equation, pinInput]);

  // Accept digit input either for calculation or for PIN after match
  const handleNumberInput = useCallback(
    (digit: string) => {
      if (equation) {
        // User is entering the PIN for the matched calculation string
        if (display !== "" || pinInput === "") {
          setDisplay("");
          setPinInput(digit);
        } else {
          setPinInput((prev) => prev + digit);
        }
        return;
      }

      if (
        !operator &&
        firstOperand !== null &&
        waitingForSecondOperand
      ) {
        setDisplay(digit);
        setFirstOperand(null);
        setOperator(null);
        setWaitingForSecondOperand(false);
        setSecondOperand(null);
        setEquation("");
        setPinInput("");
        setPinError(null);
        return;
      }

      if (waitingForSecondOperand) {
        setDisplay(digit);
        setWaitingForSecondOperand(false);
        setSecondOperand(digit);
      } else {
        const newDisplay = display === "0" ? digit : display + digit;
        setDisplay(newDisplay);
        if (operator && firstOperand !== null) {
          setSecondOperand((prev) => (prev ? prev + digit : digit));
        }
      }
    },
    [
      display,
      waitingForSecondOperand,
      operator,
      firstOperand,
      pinInput,
      equation,
      secondOperand
    ]
  );

  const handleOperator = useCallback(
    (nextOperator: string) => {
      const inputValue = parseFloat(display);
      if (firstOperand === null) {
        setFirstOperand(inputValue);
      } else if (operator) {
        const result = performCalculation(operator, firstOperand, inputValue);
        setDisplay(String(result));
        setFirstOperand(result);
      }
      setWaitingForSecondOperand(true);
      setOperator(nextOperator);
      setSecondOperand(null);
    },
    [display, firstOperand, operator]
  );

  const performCalculation = (
    op: string,
    first: number,
    second: number
  ): number => {
    switch (op) {
      case "+":
        return first + second;
      case "-":
        return first - second;
      case "*":
        return first * second;
      case "/":
        return first / second;
      case "%":
        return first % second;
      default:
        return second;
    }
  };

  const handleClear = useCallback(() => {
    setDisplay("0");
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(false);
    setSecondOperand(null);
    setEquation("");
    setPinInput("");
    setPinError(null);
    setIsVerifyingPin(false);
  }, []);

  const handleDelete = useCallback(() => {
    if (equation) {
      if (pinInput.length > 0) {
        setPinInput(pinInput.slice(0, -1));
      }
      setPinError(null);
      return;
    }
    if (display.length > 1) {
      const newDisplay = display.slice(0, -1);
      setDisplay(newDisplay);

      if (newDisplay === "" || newDisplay === "0") {
        setDisplay("0");
        setFirstOperand(null);
        setOperator(null);
        setWaitingForSecondOperand(false);
        setSecondOperand(null);
        setEquation("");
        setPinInput("");
        setPinError(null);
        setIsVerifyingPin(false);
      }
    } else {
      setDisplay("0");
      setFirstOperand(null);
      setOperator(null);
      setWaitingForSecondOperand(false);
      setSecondOperand(null);
      setEquation("");
      setPinInput("");
      setPinError(null);
      setIsVerifyingPin(false);
    }
  }, [display, equation, pinInput]);

  return {
    display,
    handleNumberInput,
    handleOperator,
    handleClear,
    handleEqual,
    handleDelete,
    pinInput,
    isLoading,
    isError,
    error,
    refetch,
    equation, // Pass for debugging/UI if needed
    isVerifyingPin,
    pinError,
  };
};
