import * as React from "react";
import graphql from "babel-plugin-relay/macro";
import { createFragmentContainer } from "react-relay";
import { formattedDiceRoll_diceRoll } from "./__generated__/formattedDiceRoll_diceRoll.graphql";
import styled from "@emotion/styled";

const StyledDiceRoll = styled.span`
  padding: 4px;
  line-height: 28px;
`;

const Wrapper = styled.span`
  padding: 4px;
  background: white;
  border-radius: 3px;
  border: 1px solid #d1d1d1;
`;

const EqualSign = styled.span`
  padding: 4px;
`;

const colors = {
  fail: "#730505",
  crit: "#247305",
};

const RollResult = styled.span<{ type: "DEFAULT" | "MIN" | "MAX" | unknown }>`
  color: ${(p) =>
    p.type === "MIN" ? colors.fail : p.type === "MAX" ? colors.crit : null};
  font-weight: ${(p) => (p.type !== "DEFAULT" ? "bold" : null)};
`;

const DiceRollRenderer: React.FC<{
  diceRoll: formattedDiceRoll_diceRoll;
}> = ({ diceRoll }) => {
  return (
    <StyledDiceRoll>
      <Wrapper>
        {diceRoll.detail.map((node) => {
          switch (node.__typename) {
            case "DiceRollDiceRollNode":
              return node.rollResults.map((result, index) => (
                <span key={index}>
                  <RollResult type={result.category}>
                    {result.result}
                  </RollResult>{" "}
                  ({result.dice})
                  {index + 1 === node.rollResults.length ? null : " + "}{" "}
                </span>
              ));
            case "%other":
              return null;
            default:
              return node.content + " ";
          }
        })}
      </Wrapper>
      <EqualSign>{" = "}</EqualSign>
      <Wrapper>
        <strong>{diceRoll.result}</strong>
      </Wrapper>
    </StyledDiceRoll>
  );
};

export const FormattedDiceRoll = createFragmentContainer(DiceRollRenderer, {
  diceRoll: graphql`
    fragment formattedDiceRoll_diceRoll on DiceRoll {
      result
      detail {
        ... on DiceRollOperatorNode {
          __typename
          content
        }
        ... on DiceRollConstantNode {
          __typename
          content
        }
        ... on DiceRollOpenParenNode {
          __typename
          content
        }
        ... on DiceRollCloseParenNode {
          __typename
          content
        }
        ... on DiceRollDiceRollNode {
          __typename
          content
          rollResults {
            dice
            result
            category
          }
        }
      }
    }
  `,
});
