import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { Input } from "./ui/input";
import { today, dateLabel } from "@/lib/utils";
export function defaultRange() {
  const end = today();
  const d = new Date();
  d.setMonth(d.getMonth() - 5, 1);
  return {
    start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
    end,
  };
}
export function DateRange({
  value,
  onChange,
}: {
  value: { start: string; end: string };
  onChange: (v: { start: string; end: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
      >
        <CalendarDays />
        <span className="date-range-text">
          {dateLabel(value.start)} – {dateLabel(value.end)}
        </span>
        <ChevronDown size={13} />
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Choose a date range"
        description="Explore how your business has moved over time."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onChange(draft);
            setOpen(false);
          }}
        >
          <div className="quick-ranges">
            {[1, 3, 6, 12].map((n) => (
              <Button
                type="button"
                variant="outline"
                size="sm"
                key={n}
                onClick={() => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - n + 1, 1);
                  setDraft({
                    start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
                    end: today(),
                  });
                }}
              >
                {n} month{n > 1 ? "s" : ""}
              </Button>
            ))}
          </div>
          <div className="form-grid">
            <label>
              Start date
              <Input
                type="date"
                required
                value={draft.start}
                max={draft.end}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
              />
            </label>
            <label>
              End date
              <Input
                type="date"
                required
                value={draft.end}
                min={draft.start}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
              />
            </label>
          </div>
          <div className="modal-actions">
            <Button
              variant="outline"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button>Apply range</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
