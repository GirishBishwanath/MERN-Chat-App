import { useState, type FormEvent } from "react";
import { FaSearch } from "react-icons/fa";
import toast from "react-hot-toast";
import { useUsers } from "../../hooks/useUsers";
import { useConversationStore } from "../../state/conversationStore";

function Search() {
  const [search, setSearch] = useState("");
  const { users } = useUsers();
  const setSelectedConversation = useConversationStore(
    (state) => state.setSelectedConversation
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const query = search.trim().toLowerCase();
    if (!query) return;

    const conversation = users.find((user) =>
      user.fullname.toLowerCase().includes(query)
    );

    if (!conversation) {
      toast.error("User not found");
      return;
    }

    setSelectedConversation(conversation);
    setSearch("");
  };

  return (
    <div className="h-[10vh]">
      <div className="px-6 py-4">
        <form onSubmit={handleSubmit}>
          <div className="flex space-x-3">
            <label className="border-[1px] border-gray-700 bg-slate-900 rounded-lg p-3 flex items-center gap-2 w-[80%]">
              <input
                type="text"
                className="grow outline-none bg-transparent"
                placeholder="Search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <button type="submit" aria-label="Search users">
              <FaSearch className="text-5xl p-2 hover:bg-gray-600 rounded-full duration-300" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Search;
