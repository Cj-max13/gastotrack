"""
Gasto AI Agent — ReAct-style agent that reasons, uses tools, and responds.

Flow per user message:
  1. Agent receives message + conversation history + live tool results
  2. Gemini decides: call a tool OR give final answer
  3. If tool call → execute tool → feed result back → repeat (max 4 steps)
  4. Final answer returned to user
"""
import json
import re
from app.services.gemini import get_client
from app.services.agent_tools import TOOLS, TOOL_DESCRIPTIONS
from google.genai import types

MODEL = "gemini-2.0-flash"

AGENT_SYSTEM = """You are Gasto, an AI financial agent for GastoTrack — a Filipino expense tracker app.

You have access to real-time tools that fetch the user's actual transaction data.
Always use tools to get real data before answering questions about spending.

Your personality:
- Warm, encouraging, and practical
- Use Filipino context (GCash, Grab, Jollibee, SM, Meralco, etc.)
- Keep answers concise and actionable
- Use emojis naturally
- Never make up numbers — always use tool data

""" + TOOL_DESCRIPTIONS


def _parse_tool_call(text: str) -> dict | None:
    """Try to extract a JSON tool call from the model's response."""
    text = text.strip()
    # Try direct JSON parse
    try:
        obj = json.loads(text)
        if "action" in obj:
            return obj
    except json.JSONDecodeError:
        pass
    # Try extracting JSON from markdown code block
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            obj = json.loads(match.group(1))
            if "action" in obj:
                return obj
        except json.JSONDecodeError:
            pass
    # Try finding raw JSON object in text
    match = re.search(r'\{"action".*?\}', text, re.DOTALL)
    if match:
        try:
            obj = json.loads(match.group(0))
            if "action" in obj:
                return obj
        except json.JSONDecodeError:
            pass
    return None


def run_agent(message: str, history: list[dict], token: str) -> dict:
    """
    Run the agent loop.
    Returns: {"reply": str, "tool_calls": list, "steps": int}
    """
    client = get_client()
    tool_calls_made = []
    steps = 0
    max_steps = 4

    # Build initial contents
    contents = [
        types.Content(role="user",  parts=[types.Part(text=AGENT_SYSTEM)]),
        types.Content(role="model", parts=[types.Part(text="Understood! I'm Gasto, your AI financial agent. I can look up your real spending data and help you manage your budget. What would you like to know? 💸")]),
    ]

    # Add conversation history
    for turn in history:
        contents.append(types.Content(
            role=turn["role"],
            parts=[types.Part(text=p) for p in turn["parts"]],
        ))

    # Add current user message
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    while steps < max_steps:
        steps += 1

        try:
            response = client.models.generate_content(model=MODEL, contents=contents)
            reply_text = response.text.strip()
        except Exception as e:
            err = str(e)
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                return {
                    "reply": "⏳ Too many requests — please wait a few seconds and try again!",
                    "tool_calls": tool_calls_made,
                    "steps": steps,
                }
            return {
                "reply": f"😔 Could not get a response. ({type(e).__name__})",
                "tool_calls": tool_calls_made,
                "steps": steps,
            }

        # Check if model wants to call a tool
        tool_call = _parse_tool_call(reply_text)

        if tool_call:
            action = tool_call.get("action", "")
            args = tool_call.get("args", {})

            if action not in TOOLS:
                # Unknown tool — tell the model
                contents.append(types.Content(role="model", parts=[types.Part(text=reply_text)]))
                contents.append(types.Content(role="user",  parts=[types.Part(text=f"Tool '{action}' not found. Available: {list(TOOLS.keys())}")]))
                continue

            # Execute the tool
            tool_fn = TOOLS[action]
            try:
                # Inject token into all tool calls
                if "token" not in args:
                    args["token"] = token
                tool_result = tool_fn(**args)
            except Exception as e:
                tool_result = {"success": False, "error": str(e)}

            tool_calls_made.append({"tool": action, "args": {k: v for k, v in args.items() if k != "token"}, "result": tool_result})

            # Feed tool result back to the model
            result_text = f"Tool '{action}' result:\n{json.dumps(tool_result, indent=2, default=str)}"
            contents.append(types.Content(role="model", parts=[types.Part(text=reply_text)]))
            contents.append(types.Content(role="user",  parts=[types.Part(text=result_text)]))

        else:
            # Model gave a final answer
            return {
                "reply": reply_text,
                "tool_calls": tool_calls_made,
                "steps": steps,
            }

    # Max steps reached — ask model to summarize
    contents.append(types.Content(
        role="user",
        parts=[types.Part(text="Please give your final answer to the user based on the data collected.")],
    ))
    try:
        final = client.models.generate_content(model=MODEL, contents=contents)
        return {"reply": final.text.strip(), "tool_calls": tool_calls_made, "steps": steps}
    except Exception:
        return {"reply": "I gathered your data but ran out of steps. Please try a more specific question.", "tool_calls": tool_calls_made, "steps": steps}
