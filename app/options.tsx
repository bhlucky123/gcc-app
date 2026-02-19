import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

const OptionsPage = () => {
  const { selectedDraw } = useDrawStore();
  const { user } = useAuthStore()

  // Define menu items with their corresponding routes
  const menuItems = [
    {
      label: "Book Ticket",
      route: `/book`,
    },
    {
      label: "Sales Report",
      route: `/sales-report`,
    },
    {
      label: "Daily Report",
      route: `/daily-report`,
    },
    {
      label: "Winnings",
      route: `/winnings`,
    },
    {
      label: "Last Sale",
      route: `/last-sale`,
    },
    {
      label: "Result",
      route: `/result`,
    }
  ];

  return (
    <View className="flex-1 bg-white px-6 py-8">
      <Text className="text-xl font-semibold text-center mb-6 text-black">
        {selectedDraw?.name || "Draw Options"}
      </Text>


      {/* {
        (user?.user_type === "DEALER" || user?.user_type === "AGENT") && (
          <TouchableOpacity
            className="bg-gray-100 rounded-lg py-4 px-4 mb-3"
            activeOpacity={0.7}
            onPress={() => {
              router.push("/book");
            }}
          >
            <Text className="text-center text-base text-black">Book Ticket</Text>
          </TouchableOpacity>
        )
      } */}

      {menuItems.map((item, index) => (
        <TouchableOpacity
          key={index}
          className="bg-gray-100 rounded-lg py-4 px-4 mb-3"
          activeOpacity={0.7}
          onPress={() => {
            router.push(item.route as any);
          }}
        >
          <Text className="text-center text-base text-black">{item.label}</Text>
        </TouchableOpacity>
      ))}

      {
        (user?.user_type === "ADMIN" || user?.user_type === "DEALER") && (
          <TouchableOpacity
            className="bg-gray-100 rounded-lg py-4 px-4 mb-3"
            activeOpacity={0.7}
            onPress={() => {
              router.push("/limit-count");
            }}
          >
            <Text className="text-center text-base text-black">Limit Count</Text>
          </TouchableOpacity>
        )
      }

{
        (user?.user_type === "AGENT" || user?.user_type === "DEALER") && (
          <TouchableOpacity
            className="bg-gray-100 rounded-lg py-4 px-4 mb-3"
            activeOpacity={0.7}
            onPress={() => {
              router.push("/my-commission");
            }}
          >
            <Text className="text-center text-base text-black">My Commission</Text>
          </TouchableOpacity>
        )
      }

{
        user?.user_type === "ADMIN" && (
          <TouchableOpacity
            className="bg-gray-100 rounded-lg py-4 px-4 mb-3"
            activeOpacity={0.7}
            onPress={() => {
              router.push("/top-numbers");
            }}
          >
            <Text className="text-center text-base text-black">Top Numbers</Text>
          </TouchableOpacity>
        )
      }
    </View>
  );
};

export default OptionsPage;
